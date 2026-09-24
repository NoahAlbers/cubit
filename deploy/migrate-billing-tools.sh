#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run schema migrations as the deployment operator.' >&2; exit 1; }
# Additive only; old releases remain compatible during rollback. Back up each
# schema before invoking this script. App database users keep CRUD-only grants.
for schema in cubit_review cubit_demo; do
  [[ $(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$schema'") == 1 ]] || continue
  for definition in 'tokenVersion:int unsigned NOT NULL DEFAULT 0' 'loginDisabled:tinyint NOT NULL DEFAULT 0'; do
    name=${definition%%:*}; column_type=${definition#*:}
    if [[ $(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$schema' AND TABLE_NAME='member' AND COLUMN_NAME='$name'") == 0 ]]; then
      mysql "$schema" -e "ALTER TABLE member ADD COLUMN $name $column_type"
    fi
  done
  mysql "$schema" < "$(dirname "$0")/../CubitServices/src/dev/waiver-documents.sql"
  mysql "$schema" < "$(dirname "$0")/../CubitServices/src/dev/backups.sql"
  if [[ $(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$schema' AND TABLE_NAME='waiver_version' AND COLUMN_NAME='providerFingerprint'") == 0 ]]; then
    mysql "$schema" -e 'ALTER TABLE waiver_version ADD COLUMN providerFingerprint varchar(255) NULL'
  fi
  for field in payerEmail payerName; do
    if [[ $(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$schema' AND TABLE_NAME='payment_event' AND COLUMN_NAME='$field'") == 0 ]]; then
      mysql "$schema" -e "ALTER TABLE payment_event ADD COLUMN $field varchar(255) NOT NULL DEFAULT ''"
    fi
  done
  if [[ $(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$schema' AND TABLE_NAME='plan' AND COLUMN_NAME='revision'") == 0 ]]; then
    mysql "$schema" -e 'ALTER TABLE plan ADD COLUMN revision int NOT NULL DEFAULT 1'
  fi
  mysql "$schema" < "$(dirname "$0")/../CubitServices/src/dev/staff-tools.sql"
  for definition in 'idx_audit_time:createdAt,id' 'idx_audit_member_time:memberId,createdAt' 'idx_audit_author:author'; do
    name=${definition%%:*}; columns=${definition#*:}
    if [[ $(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$schema' AND TABLE_NAME='operations_audit' AND INDEX_NAME='$name'") == 0 ]]; then
      mysql "$schema" -e "CREATE INDEX $name ON operations_audit ($columns)"
    fi
  done
done
