# Dedicated backup and audit server

This server accepts encrypted restic snapshots and an append-only audit archive.
It does not host Cubit or contact the door/payment/email systems. Installation is
an operator task; no server addresses or credentials belong in Git.

## Separation of authority

- Caddy requires the CRM's source IP and scoped credentials. Repository access is
  read/append only; **all remote DELETE, PUT and PATCH requests are rejected**.
  Keys, configuration and retention cannot be changed through this connection.
- rest-server also runs in append-only mode and rejects existing-object writes.
  Its separate unprivileged account can access only the encrypted repository.
- The CRM worker keeps restic's temporary locks in an authenticated, ephemeral
  loopback gateway (`deploy/vault-client.py`). Lock creation/removal never reaches
  this server. One CRM worker owns a process lock; backup-server maintenance stops
  the receiver while it checks, restores or prunes. Before pruning expired data,
  it drains for 1,850 seconds, longer than the CRM command's 1,800-second timeout,
  so an interrupted copy cannot resume referencing newly collected packs.
  No drain is needed when nothing expires. Audits continue during maintenance.
  Do not add another writer or increase the client timeout without reviewing this.
- Audit append/read tokens are separate. The archive API runs as another
  unprivileged account, has no shell/retention endpoints and cannot access backups
  or root's recovery secrets. Existing audit IDs cannot change. SQLite rejects
  record updates/deletes and a receiver-timestamped hash chain detects alteration.
- The CRM IPs cannot connect to backup-server SSH. Its administrator credentials
  and root recovery configuration are never copied to the CRM.

This protects **already accepted** history from a compromised CRM credential.
It cannot force a compromised CRM to send truthful future data, prevent it from
stopping future backups, or stop an attacker from consuming the allowed storage.
Backup-server root and the hosting account remain trusted. Independent monitoring
and operator credential custody are required.

## Install

Use a dedicated Ubuntu host, Python 3.12+, Caddy, restic 0.18+, Docker, SQLite,
apache2-utils, and a checksum-verified official rest-server 0.14 release.
Install `server.py`, `maintain.py`, and a copy of `deploy/backup-worker.py` into
root-owned `/opt/cubit-vault/` (0644). Keep code separate from all private data.

Supply a private 0600 provisioning JSON to `sudo python3 install.py FILE` with:
`hostname`, `crmIPv4`, `crmIPv6`, independently random 48-byte `readToken`,
`writeToken`, `repositoryToken`, the existing restic `repositoryPassword`,
`restoreImage` (official MySQL pinned digest), and `retentionDays` (minimum 30).
Run only on the backup host. It initializes a new repository if absent and refuses
to replace an existing recovery password. Delete the staging JSON after custody
and connection checks. Reinstallation must preserve its existing credentials.

The repository quota is 20 GiB. The audit SQLite store is capped at approximately
1 GiB and rejects new writes below a 2 GiB free-space reserve. Reaching capacity
never automatically removes audit history. Monitor disk growth and increase
capacity through the operator before these limits are reached.

On the CRM, root adds a `remote` object to `/etc/cubit-backup/config.json`:

```json
{"type":"rest","repository":"rest:https://BACKUP_HOST/repository/","username":"crm","password":"SUPPLY_PRIVATELY","retentionProtected":true}
```

Root creates `/etc/cubit-backup/audit.json` (0600):

```json
{"url":"https://BACKUP_HOST/archive","writeToken":"SUPPLY_PRIVATELY","readToken":"SUPPLY_PRIVATELY"}
```

Only the review application's private environment receives `AUDIT_VAULT_URL`
(`https://BACKUP_HOST/archive`) and `AUDIT_VAULT_READ_TOKEN`. Never configure these
on synthetic demo/local workspaces; code also refuses those modes.

Deploy the audit-outbox migration as the database operator. Every audit INSERT,
including legacy/raw SQL producers, captures its immutable delivery payload in
the same transaction. Historical records are backfilled once. Install and enable
`cubit-audit-forwarder.service` and `.timer` on the CRM. Every 15 seconds it sends
pending records, and marks only acknowledged rows delivered. Outages leave rows
queued; conflicts retain the original archive and require operator inspection.
No original audit or outbox records are deleted by the sender.

Enable off-server copies in Settings & Automation and run a backup and recovery
test. Failed copies retry every five minutes and prevent local cleanup while
off-server copies are enabled. The UI reads the remote audit archive; an outage
shows a labelled local fallback rather than silently claiming remote verification.

## Retention, status and independent restoration

On the backup server, `/etc/cubit-vault/operator.json` is root-only. Retention is
at least 30 days from **receiver first observation**, not the writer's claimed
snapshot date. The last verified snapshot remains until another passes recovery.
No snapshot expiry runs until a verified recovery point exists. Audit records
have no automatic expiry. CRM settings cannot shorten this policy.

Run these once, inspect results, then enable the timers:

```sh
sudo python3 /opt/cubit-vault/maintain.py --inventory
sudo python3 /opt/cubit-vault/maintain.py --restore
sudo systemctl enable --now cubit-vault-inventory.timer cubit-vault-maintenance.timer cubit-vault-recovery.timer
```

Inventory runs every minute. Maintenance runs daily at 05:30 Eastern; an independent
restore runs Sunday at 06:00 Eastern. These schedules belong to the backup operator.
Failure status survives ordinary inventory refreshes. Recovery uses the pinned
MySQL image in a networkless temporary container, checks both Cubit databases,
waiver BLOB hashes, DocuSeal SQLite and retained files, then removes the container.
Maintenance makes a consistent root-only audit database copy and checks its chain.

Private locations:

| Location | Purpose |
| --- | --- |
| `/var/lib/cubit-vault/repository/crm` | Encrypted snapshots |
| `/var/lib/cubit-vault/audit/audit.sqlite3` | Accepted immutable audit records |
| `/var/lib/cubit-vault/operator/audit-recovery.sqlite3` | Independently checked archive copy |
| `/var/lib/cubit-vault/operator/receipts.json` | Trusted receipt times and recovery evidence |
| `/var/lib/cubit-vault/operator/recovery-config.tgz` | Explicitly approved, root-only service-secret escrow |
| `/etc/cubit-vault/repository.password` | Root-only restic recovery key |
| `/var/lib/cubit-vault/status/backup.json` | Secret-free status exposed through authenticated API |

Keep operator SSH credentials and another copy of the recovery key in an
organization-controlled password manager. Refresh the root-only configuration
escrow after secret rotations through a trusted operator workstation; the CRM
cannot update or read that escrow. A full replacement-application rehearsal,
including real login and document access, remains a separate pre-launch gate.
Follow [the recovery runbook](../BACKUPS.md); never restore over the working CRM.
