#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run schema migrations as the deployment operator.' >&2; exit 1; }
# update-review.sh backs up each installed schema before this step.
services=$(cd "$(dirname "$0")/../CubitServices" && pwd)
node=/opt/cubit/tools/node-v22.23.3-linux-x64/bin/node
export CUBIT_MIGRATION_USER=root
export CUBIT_MIGRATION_SOCKET=/var/run/mysqld/mysqld.sock
unset CUBIT_MIGRATION_PASSWORD
cd "$services"
for schema in cubit_review cubit_demo; do
  [[ $(mysql -N -B -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$schema'") == 1 ]] || continue
  if [[ $schema == cubit_review ]]; then env_file=/etc/cubit/review.env; else env_file=/etc/cubit-demo/demo.env; fi
  "$node" --env-file="$env_file" dist/operator/migrate.js run
done
