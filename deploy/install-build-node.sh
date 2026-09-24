#!/usr/bin/env bash
set -euo pipefail
# Install the verified build runtime separately from Ubuntu's API runtime.
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
[[ $(uname -m) == x86_64 ]] || { echo 'This installer supports x86_64 only.' >&2; exit 1; }
version=v22.23.3
archive="node-${version}-linux-x64.tar.xz"
destination="/opt/cubit/tools/node-${version}-linux-x64"
if [[ -x "$destination/bin/node" ]] && [[ $("$destination/bin/node" --version) == "$version" ]]; then
  echo "Build runtime $version is already installed."
  exit 0
fi
work=$(mktemp -d /tmp/cubit-build-node.XXXXXX)
trap 'rm -rf "$work"' EXIT
curl --fail --silent --show-error --location "https://nodejs.org/dist/${version}/${archive}" -o "$work/$archive"
printf '%s  %s\n' 'df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de' "$work/$archive" | sha256sum --check
install -d -m 755 /opt/cubit/tools
tar -xJf "$work/$archive" -C /opt/cubit/tools --no-same-owner
chown -R root:root "$destination"
chmod -R a+rX "$destination"
"$destination/bin/node" --version
