# Backup and recovery operations

Staff manage schedules, retention, and recovery tests in **Settings & Automation**.
The root-owned systemd worker checks the queue every minute. Manual, daily,
weekly, and monthly schedules are supported, with a chosen time zone. Missed
schedules run once after recovery; a 31st-of-month schedule uses the last day of
short months. The default is daily at 02:15 America/New_York, seven local copies,
and a recovery test every 30 days. Disable either schedule using Manual only.

## Operator setup

Install Python 3.12+, restic 0.18+, MySQL client, Docker, and curl. Apply
`CubitServices/src/dev/backups.sql` to each application schema (also included in
the deployment migration). Install the two `cubit-backup` systemd units from
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

## Connect private off-server storage later

Off-server storage is deliberately unconfigured until an operator supplies a
private S3-compatible bucket. Configure least-privilege access limited to its
backup prefix (list/read/write/delete for retention); block public access.
Provider versioning or object lock may affect deletion and storage costs.

Add a `remote` object to the root-only config (never application settings):

```json
"remote": {
  "repository": "s3:https://YOUR_S3_ENDPOINT/PRIVATE_BUCKET/cubit",
  "accessKey": "SUPPLY_PRIVATELY",
  "secretKey": "SUPPLY_PRIVATELY",
  "region": "YOUR_REGION"
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
files, private service configuration, and deployment scripts. Databases are
individually consistent; they do not form one distributed transaction. Code is
recovered from the recorded Git release. The external encryption key is not
included inside its own backup.

Only snapshots tagged `cubit-managed-v1` are pruned. Retention keeps the latest
configured number (3–365) in each location, after a new backup/copy succeeds.
Remote copy failure prevents retention cleanup for that run. Old-style archives
are untouched. Do not share this dedicated repository with unrelated services.

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
3. Verify `manifest.json` hashes and inspect the configuration archive before
   applying it. Keep the replacement application stopped and external
   integrations disabled. Import each compressed SQL dump into its matching
   empty schema; recreate database users/grants from private configuration.
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

The backup status checks the public health endpoint with normal certificate
verification and checks its HTTP redirect hourly. Before operational launch,
repeat login/download checks on the final hostname, inspect Caddy's service
logs and certificate renewal, complete off-server and replacement-host recovery
tests, and choose staff-approved retention. HTTPS is already active on review;
these changes do not make review a live makerspace integration.
