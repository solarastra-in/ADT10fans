#!/usr/bin/env bash
# Starts a throwaway dev server on an empty data dir and runs the API checks against it.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=$(mktemp -d)
TEST_PORT=$((20000 + RANDOM % 20000))
DATA_DIR="$DIR" ADMIN_EMAILS=admin@test.dev GEMINI_API_KEY="" FEED_SYNC_MINUTES=0 PORT=$TEST_PORT setsid npx tsx server.ts > "$DIR/server.log" 2>&1 &
PID=$!
cleanup() { kill -- -$PID 2>/dev/null || true; P=$(lsof -t -i:$TEST_PORT 2>/dev/null || true); [ -n "$P" ] && kill $P 2>/dev/null || true; rm -rf "$DIR"; }
trap cleanup EXIT
for i in $(seq 1 60); do curl -sf "http://localhost:$TEST_PORT/api/health" >/dev/null && break; sleep 0.5; done
BASE="http://localhost:$TEST_PORT" node tests/api.e2e.mjs
