# Clean up after the lab: stop and remove the containers, volumes, network and the built backend image.
# Usage: .\cleanup-lab.ps1
# If scripts are blocked: powershell -ExecutionPolicy Bypass -File .\cleanup-lab.ps1
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

# Native commands do not stop the script on failure, so check the exit code.
function Invoke-Docker {
    docker @args
    if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') failed (exit code $LASTEXITCODE)" }
}

Write-Host "==> Stopping and removing containers, volumes, network and local images"
Invoke-Docker compose down -v --rmi all --remove-orphans

Write-Host "==> Removing dangling images"
Invoke-Docker image prune -f

Write-Host "==> Cleanup done"
