#!/usr/bin/env bash
set -euo pipefail
umask 022
# Installed root-owned as /usr/local/sbin/cubit-update. Run with sudo.
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
exec 9>/run/cubit-update.lock
flock -n 9 || { echo 'An update is already running.' >&2; exit 1; }
source_dir=/opt/cubit/source
if [[ ${1:-} == --bundle && ${2:-} == /home/ubuntu/cubit-source.bundle && $# -eq 2 ]]; then
  runuser -u ubuntu -- git -C "$source_dir" bundle verify "$2"
  runuser -u ubuntu -- git -C "$source_dir" fetch "$2" refs/remotes/origin/main:refs/remotes/origin/main
elif [[ $# -eq 0 ]]; then
  runuser -u ubuntu -- env GIT_TERMINAL_PROMPT=0 git -C "$source_dir" fetch origin main
else
  echo 'Usage: cubit-update [--bundle /home/ubuntu/cubit-source.bundle]' >&2
  exit 1
fi
revision=$(runuser -u ubuntu -- git -C "$source_dir" rev-parse origin/main)
release="/opt/cubit/releases/${revision}-$(date -u +%Y%m%dT%H%M%SZ)"
previous=''
if [[ -L /opt/cubit/current && -d /opt/cubit/current ]]; then
  previous=$(readlink -f /opt/cubit/current)
fi
install -d -o ubuntu -g ubuntu "$release"
runuser -u ubuntu -- bash -c 'git -C "$1" archive "$2" | tar -x -C "$3"' _ "$source_dir" "$revision" "$release"
runuser -u ubuntu -- bash -c '
  set -euo pipefail
  cd "$1"
  export CI=true NG_CLI_ANALYTICS=false
  export PATH="/opt/cubit/tools/node-v22.23.3-linux-x64/bin:$PATH"
  node dev/check-web-runtime.cjs
  # Copy rather than hardlink dependencies: sealing release ownership must not
  # change ownership/permissions of the shared pnpm build cache.
  pnpm --dir CubitServices install --frozen-lockfile --package-import-method=copy
  pnpm --dir CubitWeb install --frozen-lockfile --package-import-method=copy
  node dev/build-web.cjs
  pnpm --dir CubitWeb test
  pnpm --dir CubitServices build
  cd CubitServices
  node tests/local-safety.cjs
  node tests/hosted-safety.cjs
  node tests/hosted-demo.cjs
  node tests/security-hardening.cjs
  node tests/remembered-greeting.cjs
  node tests/login-greeting-integration.cjs
  node tests/billing.cjs
  node tests/activity-patterns.cjs
  node tests/review-controls.cjs
' _ "$release"
# Read-only code for the service. Secrets and database are outside all releases.
chown -R root:root "$release"
chmod -R a+rX "$release"
install -d -m 700 /var/backups/cubit
umask 077
mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF cubit_review | gzip > "/var/backups/cubit/before-${revision}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
# Keep the service and code together when a release changes its working directory.
unit_path=/etc/systemd/system/cubit-review.service
unit_backup=$(mktemp /run/cubit-review-service.XXXXXX)
demo_unit=/etc/systemd/system/cubit-demo.service
demo_backup=''
trap 'rm -f "$unit_backup"; if [[ -n "$demo_backup" ]]; then rm -f "$demo_backup"; fi' EXIT
cp -p "$unit_path" "$unit_backup"
if [[ -f "$demo_unit" ]]; then
  demo_backup=$(mktemp /run/cubit-demo-service.XXXXXX)
  cp -p "$demo_unit" "$demo_backup"
  mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF cubit_demo | gzip > "/var/backups/cubit/demo-before-${revision}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
fi
bash "$release/deploy/migrate-billing-tools.sh"
activate() {
  install -m 644 "$release/deploy/cubit-review.service" "$unit_path" || return
  if [[ -n "$demo_backup" ]]; then install -m 644 "$release/deploy/cubit-demo.service" "$demo_unit" || return; fi
  ln -sfn "$release" /opt/cubit/current.next && mv -Tf /opt/cubit/current.next /opt/cubit/current || return
  systemctl daemon-reload || return
  if [[ -n "$demo_backup" ]]; then systemctl restart cubit-demo || return; fi
  systemctl restart cubit-review
}
if activate; then
  for attempt in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:5001/health | grep -q '"mode":"hosted-review"'; then
      if [[ -n "$demo_backup" ]] && ! curl -fsS http://127.0.0.1:5002/health | grep -q '"mode":"hosted-demo"'; then
        sleep 1
        continue
      fi
      echo "Activated $revision"
      # Keep the previous release until activation succeeds, then retain only
      # current code. Database backups have their own independent retention.
      if ! python3 "$release/deploy/prune-releases.py" --under-update-lock --apply; then
        echo 'Release is healthy, but old-code cleanup needs operator attention.' >&2
      fi
      exit 0
    fi
    sleep 1
  done
fi
echo 'Activation failed; restoring previous code and service definition.' >&2
install -m 644 "$unit_backup" "$unit_path"
if [[ -n "$demo_backup" ]]; then install -m 644 "$demo_backup" "$demo_unit"; fi
if [[ -n "$previous" && -d "$previous" ]]; then
  ln -sfn "$previous" /opt/cubit/current.next
  mv -Tf /opt/cubit/current.next /opt/cubit/current
  systemctl daemon-reload
  if [[ -n "$demo_backup" ]]; then systemctl restart cubit-demo; fi
  systemctl restart cubit-review
else
  systemctl daemon-reload
  systemctl stop cubit-review
fi
exit 1
