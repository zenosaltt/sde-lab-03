#!/usr/bin/env bash
# Start the lab in Docker, seed missing data, and follow the backend logs.
# Usage: ./start-lab.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

[ -f .env ] || { echo "Missing .env in $ROOT" >&2; exit 1; }

echo "==> Deleting old backend data"
docker compose down -v

echo "==> Starting the backend, MySQL and Redis"
docker compose up -d --build --renew-anon-volumes

echo "==> Creating tables and seeding data"
docker compose exec backend npm run seed

echo "==> Backend: http://localhost:3000 (Ctrl+C stops log streaming)"
exec docker compose logs -f backend
