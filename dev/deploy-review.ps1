# Fetch the private GitHub repository using this PC's existing Git credentials,
# then transfer a source-only Git bundle. No GitHub credential is copied to the VPS.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot
try {
    git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'GitHub fetch failed.' }
    New-Item -ItemType Directory -Force -Path '.private/deploy' | Out-Null
    git bundle create '.private/deploy/cubit-source.bundle' refs/remotes/origin/main
    if ($LASTEXITCODE -ne 0) { throw 'Source bundle failed.' }
    $sshExe = Join-Path $env:WINDIR 'System32/OpenSSH/ssh.exe'
    $scpExe = Join-Path $env:WINDIR 'System32/OpenSSH/scp.exe'
    & $scpExe '.private/deploy/cubit-source.bundle' 'ubuntu@vps-6485942b.vps.ovh.us:cubit-source.bundle'
    if ($LASTEXITCODE -ne 0) { throw 'Source transfer failed.' }
    # Refresh the root-owned updater from the same reviewed commit before running it.
    $remoteUpdate = 'git -C /opt/cubit/source fetch /home/ubuntu/cubit-source.bundle refs/remotes/origin/main:refs/remotes/origin/main && git -C /opt/cubit/source show origin/main:deploy/update-review.sh > /home/ubuntu/cubit-update.sh && bash -n /home/ubuntu/cubit-update.sh && sudo install -m 755 /home/ubuntu/cubit-update.sh /usr/local/sbin/cubit-update && sudo cubit-update --bundle /home/ubuntu/cubit-source.bundle'
    & $sshExe 'ubuntu@vps-6485942b.vps.ovh.us' $remoteUpdate
    if ($LASTEXITCODE -ne 0) { throw 'Review deployment failed; inspect server logs.' }
} finally {
    Pop-Location
}
