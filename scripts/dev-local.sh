#!/usr/bin/env bash
# Runs EvalPilot locally without Docker, on the MySQL and Redis of this machine:
#   migrations → seed → API (4000) + worker + ShopBot (4100) + web (3000).
# Ctrl+C stops everything.  `--env-only` just prepares .env (secrets) and exits.
set -euo pipefail
cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── .env ────────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  cp .env.example .env
  fail ".env was missing, so it was created from .env.example. Fill in DATABASE_URL and TEST_DATABASE_URL, then run this again."
fi
grep -q '<password>' .env && fail "Set your MySQL password in .env (DATABASE_URL / TEST_DATABASE_URL still contain <password>)."

# Generate local secrets that are still placeholders or empty (values never printed).
set_env() { # name value
  if grep -qE "^$1=" .env; then
    sed -i.bak -E "s|^$1=.*$|$1=$2|" .env && rm -f .env.bak
  else
    echo "$1=$2" >> .env
  fi
}
needs() { ! grep -qE "^$1=[^<[:space:]]" .env; }
needs JWT_SECRET && set_env JWT_SECRET "$(openssl rand -hex 32)" && echo "• generated JWT_SECRET"
needs TARGET_SECRET_KEY && set_env TARGET_SECRET_KEY "$(openssl rand -base64 32)" && echo "• generated TARGET_SECRET_KEY"
needs EVALPILOT_API_KEY && set_env EVALPILOT_API_KEY "ep_live_$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=')" && echo "• generated a local EVALPILOT_API_KEY for ShopBot traces"
# `--env-only`: stop here (used before `docker compose up`).
if [[ "${1:-}" == "--env-only" ]]; then echo "✓ .env is ready"; exit 0; fi

# ── Checks ──────────────────────────────────────────────────────────────────
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 17) ? 0 : 1)' || fail "Node 20.17+ is required (found $(node -v))."
if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -u "$(grep -E '^REDIS_URL=' .env | cut -d= -f2- || echo redis://127.0.0.1:6379)" ping >/dev/null 2>&1 || fail "Redis is not reachable. Start it: brew services start redis"
fi

# ── Build, migrate, seed ────────────────────────────────────────────────────
[[ -d node_modules ]] || { bold "Installing dependencies…"; npm ci; }
bold "Building shared packages…"
npm run build:packages --silent >/dev/null
bold "Applying database migrations…"
npx prisma migrate deploy >/dev/null || fail "Migrations failed. Is MySQL running (brew services start mysql) and DATABASE_URL correct?"
bold "Seeding the attack library and demo workspace…"
npx prisma db seed 2>&1 | grep -E '✓|•' || true

# ── Start everything ────────────────────────────────────────────────────────
trap 'echo; bold "Stopping…"; kill 0' INT TERM EXIT
run() { # label colour command…
  local label=$1 colour=$2
  shift 2
  ( "$@" 2>&1 | sed -u "s/^/$(printf '\033[%sm%-8s\033[0m ' "$colour" "$label")/" ) &
}
run api 32 npm run dev -w @evalpilot/api
run worker 36 npm run dev -w @evalpilot/worker
run shopbot 35 npm run dev -w @evalpilot/shopbot
run web 33 npm run dev -w @evalpilot/web

bold ""
bold "EvalPilot is starting:"
echo "  Web      http://localhost:3000   (demo: demo@evalpilot.dev / evalpilot-demo-2026)"
echo "  API      http://localhost:4000/api/docs"
echo "  ShopBot  http://localhost:4100/health"
echo "  Ctrl+C to stop."
wait
