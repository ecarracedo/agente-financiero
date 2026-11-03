#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Development server for the web frontend against the real backend.
#
# The containerized frontend is stopped so port conflicts cannot happen: this
# script serves the app from Vite on 5173, which proxies /api to the backend
# origin configured in frontend/.env (VITE_PROXY_TARGET).
#
# Demo mode (MSW fixtures) is intentionally NOT enabled here: unset VITE_DEMO
# makes `src/dev/demo.ts` bail out before importing any mock machinery, so every
# request reaches the live API.

docker compose stop frontend 2>/dev/null || true

# Stop any existing vite process on 5173
if command -v fuser >/dev/null 2>&1; then
  fuser -k 5173/tcp 2>/dev/null || true
elif command -v pkill >/dev/null 2>&1; then
  pkill -f "vite.*5173" 2>/dev/null || true
fi

sleep 2

cd "$ROOT/frontend"
unset VITE_DEMO
exec npm run dev -- --host 127.0.0.1 --port 5173
