#!/usr/bin/env bash
# Clean up after the lab: stop and remove the containers, volumes, network and the built backend image.
# Usage: ./cleanup-lab.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> Stopping and removing containers, volumes, network and local images"
docker compose down -v --rmi all --remove-orphans

echo "==> Removing dangling images"
docker image prune -f

echo "==> Cleanup done"
