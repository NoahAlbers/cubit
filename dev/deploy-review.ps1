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
    & $sshExe 'ubuntu@vps-6485942b.vps.ovh.us' 'sudo cubit-update --bundle /home/ubuntu/cubit-source.bundle'
    if ($LASTEXITCODE -ne 0) { throw 'Review deployment failed; inspect server logs.' }
} finally {
    Pop-Location
}
