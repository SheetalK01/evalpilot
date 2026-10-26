#!/usr/bin/env bash
# Brings the TEST database (evalpilot_test) up to the latest migration and empties every table.
# Never touches the main `evalpilot` database.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${TEST_DATABASE_URL:-}" && -f .env ]]; then
  TEST_DATABASE_URL="$(grep -E '^TEST_DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
fi
if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  echo "TEST_DATABASE_URL is not set (add it to .env)" >&2
  exit 1
fi
export TEST_DATABASE_URL

DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy >/dev/null
npx tsx scripts/reset-test-db.ts
