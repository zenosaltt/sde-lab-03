#!/usr/bin/env bash
# Clean start for the lab: reset containers and data, reseed, run the backend.
# Usage: ./start-lab.sh            (watch mode, npm run start:dev)
#        MODE=start ./start-lab.sh (single run, npm start)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

[ -f .env ] || { echo "Missing .env in $ROOT" >&2; exit 1; }

echo "==> Removing old containers and volumes (stale data)"
docker compose down -v --remove-orphans

echo "==> Starting MySQL and Redis"
docker compose up -d --wait

cd nest-backend

if [ ! -d node_modules ]; then
  echo "==> Installing dependencies"
  npm ci
fi

echo "==> Creating tables and seeding data"
npm run seed

echo "==> Starting the backend on port ${PORT:-3000}"
if [ "${MODE:-dev}" = "start" ]; then
  exec npm start
else
  exec npm run start:dev
fi
