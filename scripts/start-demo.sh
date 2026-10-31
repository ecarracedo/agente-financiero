#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Stop the container frontend if running (we use the dev server on 5173)
docker compose stop frontend 2>/dev/null || true

# Stop any existing vite process on 5173
if command -v fuser >/dev/null 2>&1; then
  fuser -k 5173/tcp 2>/dev/null || true
elif command -v pkill >/dev/null 2>&1; then
  pkill -f "vite.*5173" 2>/dev/null || true
fi

sleep 2

cd "$ROOT/frontend"
export VITE_DEMO=1
exec npm run dev -- --host 127.0.0.1 --port 5173
