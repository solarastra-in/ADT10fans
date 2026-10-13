#!/usr/bin/env bash
# End-to-end tests. Usage: bash tests/run-e2e.sh [api|storage|browser|prod|all]
#   api      API journeys against a dev server with offline fixtures, plus the legacy-store upgrade
#   storage  the GCS backend against a local fake GCS, with concurrent writers
#   browser  Playwright journeys at phone width against the production build
#   prod     production build smoke test
set -euo pipefail
cd "$(dirname "$0")/.."
WHAT="${1:-api}"
ROOT=$(mktemp -d)
PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill -- -"$p" 2>/dev/null || kill "$p" 2>/dev/null || true; done; rm -rf "$ROOT"; }
trap cleanup EXIT

export FEED_FIXTURES_DIR="$ROOT/fixtures" CRON_SECRET=test-cron-secret CRICKET_API_KEY=test-cricket-key \
  GAME_SECRET=test-game-secret SCHEDULED_JOBS=off ADMIN_EMAILS=admin@test.dev GEMINI_API_KEY= FCM_VAPID_KEY=
npx tsx tests/make-fixtures.ts "$FEED_FIXTURES_DIR" >/dev/null || { echo "fixtures failed"; exit 1; }

# start <name> <data dir> <command...>  -> sets PORT_<name>
start() {
  local name=$1 dir=$2; shift 2
  local port=$((20000 + RANDOM % 20000))
  mkdir -p "$dir"
  DATA_DIR="$dir" PORT=$port setsid "$@" > "$ROOT/$name.log" 2>&1 &
  PIDS+=($!)
  for i in $(seq 1 120); do curl -sf "http://localhost:$port/api/health" >/dev/null && break; sleep 0.25; done
  curl -sf "http://localhost:$port/api/health" >/dev/null || { echo "$name server did not start"; cat "$ROOT/$name.log"; exit 1; }
  printf -v "PORT_$name" '%s' "$port"
}

run_api() {
  node tests/i18n-check.mjs
  start dev "$ROOT/data-api" npx tsx server.ts
  BASE="http://localhost:$PORT_dev" node tests/api.e2e.mjs || { echo "--- server log"; tail -50 "$ROOT/dev.log"; exit 1; }
  node tests/legacy-store.mjs "$ROOT/data-legacy"
  start legacy "$ROOT/data-legacy" npx tsx server.ts
  BASE="http://localhost:$PORT_legacy" node tests/migration.e2e.mjs
}
run_storage() { node tests/storage.e2e.mjs "$ROOT"; }
build() { [ -f dist/_template.html ] && [ -f dist-server/server.mjs ] && [ "${REBUILD:-1}" = 0 ] || npm run build >"$ROOT/build.log" 2>&1 || { echo "build failed"; tail -40 "$ROOT/build.log"; exit 1; }; }
run_prod() {
  build
  start prod "$ROOT/data-prod" env NODE_ENV=production node dist-server/server.mjs
  BASE="http://localhost:$PORT_prod" node tests/prod.e2e.mjs
}
run_browser() {
  build
  # Browser journeys need sign-in codes, which only a non-production server returns; it serves the built client.
  start web "$ROOT/data-web" env SERVE_BUILD=1 npx tsx server.ts
  BASE="http://localhost:$PORT_web" node tests/browser.e2e.mjs
}
case "$WHAT" in
  api) run_api ;;
  storage) run_storage ;;
  browser) run_browser ;;
  prod) run_prod ;;
  all) run_api; run_storage; REBUILD=1 run_prod; REBUILD=0 run_browser ;;
  *) echo "unknown: $WHAT"; exit 2 ;;
esac
echo "e2e ($WHAT) passed"
