# Backup and recovery operations

Administration manages schedules and local retention in **Settings & Automation**.
Staff can inspect backups, create a backup and request a recovery test.
The **Saved local backups** inventory shows the actual retained repository snapshots,
creation times, and captured data sizes, refreshed by the worker every minute.
**Test this backup** checks a selected local copy in isolation. **Apply local
retention now** confirms and removes older managed local copies according to the
saved retention count; it never affects off-server storage or the working database.
Save pending settings first. Operation history records requests and outcomes;
it is separate from the inventory because historical jobs can outlive their snapshots.
The root-owned systemd worker checks the queue every minute. Manual, daily,
weekly, and monthly schedules are supported, with a chosen time zone. Missed
schedules run once after recovery; a 31st-of-month schedule uses the last day of
short months. The default is daily at 02:15 America/New_York, seven local copies,
and a recovery test every 30 days. Disable either schedule using Manual only.

## Operator setup

Install Python 3.12+, restic 0.18+, MySQL client, Docker, and curl. Run the
versioned operator migrations in `deploy/migrate-billing-tools.sh` for both
installed application schemas. Install the two `cubit-backup` systemd units from
this directory. The timer replaces the old fixed nightly timer. Old archives
are preserved and are outside the new retention policy.

Create `/etc/cubit-backup` with mode 0700 and a root-owned `config.json`, mode
0600. Use the actual local schemas, public HTTPS URL, and a reviewed, pulled
official MySQL 8.4 image pinned by its repository digest:

```json
{
  "database": "cubit_review",
  "schemas": ["cubit_review", "cubit_demo"],
  "publicUrl": "https://YOUR_CURRENT_HOSTNAME",
  "restoreImage": "mysql@sha256:REPLACE_WITH_VERIFIED_IMAGE_DIGEST"
}
```

Enable `cubit-backup.timer` after validating the configuration. The worker
creates `/etc/cubit-backup/repository.password` and an encrypted restic repository
at `/var/backups/cubit/repository`. Save the recovery key in a password manager
separate from the VPS. Losing both the VPS and its only key makes encrypted
copies unusable. Credentials and backup files must never enter Git.

The web application has no access to storage credentials or shell commands.
Only the hosted review instance can queue server jobs; synthetic demo and local
workspaces cannot. Settings edits, requests, and completed operations are audited.
Failures appear in Backup history; there are no automatic email notifications.
Check `journalctl -u cubit-backup` for operator diagnostics.

## Dedicated backup and audit VPS

The review environment uses the [dedicated vault setup](vault/README.md).
Encrypted restic copies and audit records travel over HTTPS with separate scoped
credentials. The CRM cannot delete or overwrite retained objects or change remote
retention. Remote audit reads use the protected archive, with an explicit local
fallback warning during outages. Audit writes are captured in a transactional
outbox and delivered every 15 seconds; unacknowledged records retry.

The backup server controls its own minimum 30-day retention using receiver-owned
timestamps. It preserves the last verified recovery point until another passes.
Audit records have no automatic deletion. Restic's temporary locks remain on the
CRM, so the vault rejects all HTTP deletion requests, including lock deletion.
Backup-server maintenance temporarily stops its repository receiver to exclude
writers; interrupted copies retry after service returns. Local cleanup checks
off-server copying first when remote copies are enabled.

With explicit owner approval, private service configuration is retained separately
in a root-only archive on the backup VPS. It is inaccessible through either the
repository or audit API. Refresh it through a trusted operator workstation after
secret rotation. Ordinary data backups continue to exclude service configuration.
The backup operator and hosting account remain trusted; keep independent
credentials/recovery keys in the organization's password manager.

## Alternative: private S3-compatible storage

An operator may instead supply a private S3-compatible bucket. Block public access and limit the VPS credential
to the backup prefix. Restic needs list/read/write access; it cannot use a
literally write-only credential. Deny deletion of backup data and object versions,
and deny changes to bucket versioning, lifecycle, and retention. Restic lock
objects may need a narrowly scoped delete exception for `locks/*`; test this
against the chosen provider before enabling copies.

Use provider-enforced immutable or versioned retention that a compromised VPS
cannot shorten. A separate operator identity outside this server owns expiry
and maintenance. Test that the VPS credential cannot delete a saved snapshot,
its data, or protected previous versions. Record those results and the retention
window before setting `retentionProtected: true`; that setting is an operator
attestation, not a substitute for a bucket policy. This alternative is not used by
the dedicated backup VPS.

Add a `remote` object to the root-only config (never application settings):

```json
"remote": {
  "repository": "s3:https://YOUR_S3_ENDPOINT/PRIVATE_BUCKET/cubit",
  "accessKey": "SUPPLY_PRIVATELY",
  "secretKey": "SUPPLY_PRIVATELY",
  "region": "YOUR_REGION",
  "retentionProtected": true
}
```

Run `sudo python3 /opt/cubit/current/deploy/backup-worker.py --init-remote` once
for a new empty repository. Do not initialize over an existing recovery repo.
Then enable off-server copies in the UI, run **Back up now**, and run **Test
recovery**. With off-server copies enabled, the test restores from that remote
repository. A configured destination is not proof of a successful copy; check
both operations succeeded. No off-server protection exists until these pass.

## Scope and retention

Each snapshot includes consistent exports of both MySQL schemas (including
uploaded waiver BLOBs), a consistent DocuSeal SQLite snapshot, its retained
files, a checksummed manifest, and recovery requirements. Databases are
individually consistent; they do not form one distributed transaction. Code and
deployment scripts are recovered from the recorded Git release.

New `cubit-backup-v2` snapshots exclude private service configuration and storage
credentials. Retain the restic password, each workspace's MFA encryption key,
and DocuSeal encryption/session secrets in independent secure custody. Data
backups still contain sensitive member records and authentication data, so they
remain encrypted and private. Recreate database credentials, JWT secrets and
integration credentials during recovery; new JWT secrets end existing sessions.
The worker writes a secret-free `recovery-requirements.json` with these requirements.

Previously retained v1 snapshots include private configuration. They remain
restorable and sensitive; this update does not rewrite or remove them. Review
their retention and rotate affected credentials if a repository/key was exposed.

Only local snapshots tagged `cubit-managed-v1` are pruned. Local retention keeps
the latest configured number (3–365) after a new backup/copy succeeds. Remote
copy failure prevents local retention cleanup for that run. The VPS worker
rejects remote deletion/maintenance commands; the former remote copy-count
setting is retained only for settings compatibility and does not control expiry.
Off-server retention belongs to the independently protected provider/operator
policy. Avoid relying only on keep-last counts: a compromised writer could add
many new snapshots to push good ones outside a count-based policy. Old-style
archives are untouched. Keep this repository dedicated to Cubit.

## Recovery tests and replacement-server procedure

**Test recovery** checks the encrypted repository, restores and verifies all
file hashes, restores both databases into a temporary networkless MySQL
container, checks core tables and waiver BLOB hashes, and validates DocuSeal's
SQLite database and retained file checksums. The temporary container has no host
mounts and cannot contact the makerspace. It is removed after the test. Allow
enough free disk and memory; the test uses an anonymous Docker volume and a
768 MB container memory limit. Its volume is removed with the container, including
cleanup of interrupted rehearsals when the worker next starts. Larger future
databases may require an operator-reviewed increase or a separate recovery server.

For replacement-server recovery, a server operator must:

1. Provision a separate isolated host with the same supported MySQL version,
   pinned DocuSeal image, restic, Node, and the recorded Cubit code release.
2. Retrieve the recovery key from separate secure storage. List snapshots in
   the local or off-server restic repository and restore the chosen snapshot
   into a root-only staging directory using `restic restore ID --target DIR
   --verify`. Run `restic check --read-data` first. Never restore directly over
   the current server's directories.
3. Verify `manifest.json` hashes and read `recovery-requirements.json` for v2
   snapshots. Retrieve the independently held secrets and recreate private
   configuration. Keep the replacement application stopped and external
   integrations disabled. Import each compressed SQL dump into its matching
   empty schema; recreate database users/grants with fresh credentials.
4. Restore the DocuSeal files under `/var/lib/docuseal/docuseal`, put the saved
   `docuseal.sqlite3` at `db.sqlite3`, and restore the correct service ownership.
   Restore service secrets and networking restrictions; do not expose MySQL or
   DocuSeal's internal port. Install the backup configuration/key and systemd
   units on the replacement host.
5. Start the services in review mode. Verify staff login, a member profile,
   billing history, uploaded and signed waiver downloads, and demo isolation.
   Run the isolated recovery test there too. Compare source/restore counts and
   record evidence, snapshot ID, elapsed recovery time, and any gaps.
6. Only after operator approval should DNS/traffic move to the replacement.
   A replacement-host rehearsal remains a pre-launch requirement; the built-in
   data restore test does not simulate total VPS loss or DNS cutover.

## HTTPS

`deploy/Caddyfile` uses the operator's `CUBIT_HOSTNAME` environment setting.
Keep the current VPS hostname until domain/DNS coordination is complete.
Provide it through a private Caddy systemd EnvironmentFile; validate the Caddy
configuration with that environment, then reload. Caddy obtains/renews trusted
certificates and redirects HTTP to HTTPS. Keep ports 80 and 443 reachable, and
8443 for the separately protected DocuSeal signing service.

The DocuSeal proxy exposes only signing routes and their assets publicly.
Administration and other API routes return 404 unless the connection originates
from loopback. An operator can use an SSH tunnel with the original hostname
and normal TLS verification, or add a narrowly scoped approved administrator
source IP in Caddy. Never expose port 3000 or disable certificate checks to
work around this restriction. Cubit's server-to-server API stays on loopback.
After changes, verify public signing assets still load and `/sign_in`, `/settings`,
and `/api/templates` remain inaccessible publicly. Administrator password/MFA
setup and an actual member signing rehearsal remain launch checks.

The backup status checks the public health endpoint with normal certificate
verification and checks its HTTP redirect hourly. Before operational launch,
repeat login/download checks on the final hostname, inspect Caddy's service
logs and certificate renewal, complete off-server and replacement-host recovery
tests, and choose staff-approved retention. HTTPS is already active on review;
these changes do not make review a live makerspace integration.
