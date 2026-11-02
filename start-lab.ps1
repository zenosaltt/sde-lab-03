# Start the lab in Docker, seed the database, and follow the backend logs.
# Usage: .\start-lab.ps1
# If scripts are blocked: powershell -ExecutionPolicy Bypass -File .\start-lab.ps1
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

if (-not (Test-Path .env)) {
    Write-Error "Missing .env in $PSScriptRoot"
    exit 1
}

# Native commands do not stop the script on failure, so check the exit code.
function Invoke-Docker {
    docker @args
    if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') failed (exit code $LASTEXITCODE)" }
}

Write-Host "==> Deleting old containers and volumes"
Invoke-Docker compose down -v

Write-Host "==> Starting the backend, MySQL and Redis"
Invoke-Docker compose up -d --build --renew-anon-volumes

Write-Host "==> Creating tables and seeding data"
Invoke-Docker compose exec backend npm run seed

Write-Host "==> Backend: http://localhost:3000 (Ctrl+C stops log streaming)"
Invoke-Docker compose logs -f backend
