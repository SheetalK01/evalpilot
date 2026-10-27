#!/usr/bin/env bash
# Starts the E2E stack (test database, ports 4400/4500, mock AI, high rate limits) and runs the
# k6 scripts against it.   bash perf/run.sh [traces|runs|all] (SMOKE=1 for a short CI check)
set -euo pipefail
cd "$(dirname "$0")/.."
which=${1:-all}
command -v k6 >/dev/null || { echo "k6 is not installed: https://grafana.com/docs/k6/latest/set-up/install-k6/" >&2; exit 1; }
mkdir -p perf/results

# The same environment as the Playwright stack, written to a private temp file (never printed).
envfile=$(mktemp)
chmod 600 "$envfile"
npx tsx -e "import { stackEnv } from './e2e/support/env.ts'; for (const [k, v] of Object.entries(stackEnv())) console.log('export ' + k + '=' + JSON.stringify(v));" > "$envfile"
# shellcheck disable=SC1090
source "$envfile"
rm -f "$envfile"

pids=()
cleanup() { for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT

if ! curl -sf "$API_URL/api/health" >/dev/null; then
  [[ -f apps/api/dist/main.js ]] || npm run build >/dev/null
  bash scripts/reset-test-db.sh
  npx prisma db seed >/dev/null
  LOG_LEVEL=error node apps/api/dist/main.js & pids+=($!)
  LOG_LEVEL=error node apps/worker/dist/main.js & pids+=($!)
  LOG_LEVEL=error node apps/shopbot/dist/main.js & pids+=($!)
  for _ in $(seq 1 60); do
    curl -sf "$API_URL/api/health" | grep -q '"worker":"up"' && break
    sleep 1
  done
fi

status=0
if [[ $which == traces || $which == all ]]; then
  k6 run --quiet --summary-export perf/results/traces.json perf/traces.js || status=1
fi
if [[ $which == runs || $which == all ]]; then
  k6 run --quiet --summary-export perf/results/runs.json perf/runs.js || status=1
fi
exit $status
