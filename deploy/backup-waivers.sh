#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || exit 1
exec 9>/run/cubit-backup.lock
flock -n 9 || exit 0
destination=/var/backups/cubit/nightly
install -d -m 700 "$destination"
work=$(mktemp -d "$destination/.pending.XXXXXX")
trap 'rm -rf -- "$work"' EXIT
for schema in cubit_review cubit_demo; do
  mysqldump --single-transaction --hex-blob --no-tablespaces --set-gtid-purged=OFF "$schema" | gzip > "$work/$schema.sql.gz"
  gzip -t "$work/$schema.sql.gz"
done
# DocuSeal files are append-only in normal use. Snapshot the DB first, then
# archive the volume, including originals, signed files and signing certificates.
database=/var/lib/docuseal/docuseal/db.sqlite3
[[ -f "$database" ]] || { echo 'DocuSeal database path needs configuration.' >&2; exit 1; }
sqlite3 "$database" ".backup '$work/docuseal.sqlite3'"
[[ $(sqlite3 "$work/docuseal.sqlite3" 'PRAGMA integrity_check;') == ok ]]
tar --exclude='./docuseal/db.sqlite3*' -czf "$work/docuseal-files.tgz" -C /var/lib/docuseal .
tar -czf "$work/service-config.tgz" -C /etc cubit docuseal caddy/Caddyfile
sha256sum "$work"/* > "$work/checksums.txt"
mv "$work" "$destination/$(date -u +%Y%m%dT%H%M%SZ)"
trap - EXIT
echo 'Cubit databases, waiver files, DocuSeal database, and private configuration backed up.'
# No automatic source-file deletion or backup pruning. Operators must monitor
# disk capacity and arrange an encrypted off-server copy before live use.
