#!/usr/bin/env bash
# Print PostgreSQL 42703 column errors from the API container logs.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose logs app 2>&1 | grep -iE 'column .* does not exist|42703' | tail -15 || true
echo "---"
echo "If empty, run: docker compose logs app 2>&1 | tail -80"
