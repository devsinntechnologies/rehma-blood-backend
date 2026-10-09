#!/usr/bin/env bash
# Applies participation migration SQL twice against a non-production database.
# Requires: psql, DATABASE_URL (or DATABASE_* vars matching docker-compose db on 5435).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${DATABASE_URL:-postgres://${DATABASE_USER:-postgres}:${DATABASE_PASSWORD:-postgres}@${DATABASE_HOST:-localhost}:${DATABASE_PORT:-5435}/${DATABASE_NAME:-rehma_blood}}"

echo "Target: ${URL%%@*}@***"
# Minimal stub so ALTER TABLE blood_request ... IF NOT EXISTS can run on empty test DBs.
psql "$URL" -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS blood_request (id SERIAL PRIMARY KEY);"
psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/migrations/001_participation_and_ops.sql"
psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/migrations/001_participation_and_ops.sql"
echo "Migration applied twice without error (idempotent)."
