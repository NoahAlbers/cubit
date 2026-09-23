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
  # Copy rather than hardlink dependencies: sealing release ownership must not
  # change ownership/permissions of the shared pnpm build cache.
  pnpm --dir TonicServices install --frozen-lockfile --package-import-method=copy
  pnpm --dir CubitWeb install --frozen-lockfile --package-import-method=copy
  node dev/build-web.cjs
  pnpm --dir TonicServices build
  cd TonicServices
  node tests/local-safety.cjs
  node tests/hosted-safety.cjs
  node tests/billing.cjs
' _ "$release"
# Read-only code for the service. Secrets and database are outside all releases.
chown -R root:root "$release"
chmod -R a+rX "$release"
install -d -m 700 /var/backups/cubit
umask 077
mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF cubit_review | gzip > "/var/backups/cubit/before-${revision}-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
ln -sfn "$release" /opt/cubit/current.next
mv -Tf /opt/cubit/current.next /opt/cubit/current
systemctl restart cubit-review
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:5001/health | grep -q '"mode":"hosted-review"'; then
    echo "Activated $revision"
    exit 0
  fi
  sleep 1
done
echo 'Health check failed; restoring previous code release.' >&2
if [[ -n "$previous" && -d "$previous" ]]; then
  ln -sfn "$previous" /opt/cubit/current.next
  mv -Tf /opt/cubit/current.next /opt/cubit/current
  systemctl restart cubit-review
else
  systemctl stop cubit-review
fi
exit 1
