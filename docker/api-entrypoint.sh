#!/bin/sh
# Applies pending migrations, seeds the attack library and demo workspace (idempotent), then
# starts the API. Set SKIP_MIGRATIONS=true to skip the first two steps.
set -e
cd /app
if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  # Prisma reads SHADOW_DATABASE_URL from the schema; deploy never uses it.
  export SHADOW_DATABASE_URL="${SHADOW_DATABASE_URL:-$DATABASE_URL}"
  node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
  node prisma/seed.cjs
fi
exec node apps/api/dist/main.js
