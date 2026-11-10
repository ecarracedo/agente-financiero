#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Development server for the web frontend against the real backend.
#
# Levanta postgres + backend con Docker Compose y luego sirve el frontend
# desde Vite en 5173, que proxyea /api al backend.
#
# Demo mode (MSW fixtures) es intencionalmente NO habilitado: unset VITE_DEMO
# hace que src/dev/demo.ts salte antes de importar mocks, así cada request
# llega a la API viva.

# Detiene el contenedor frontend de Docker para evitar conflictos de puerto.
docker compose stop frontend 2>/dev/null || true

# Levanta infraestructura (postgres + backend) si no está arriba.
docker compose up -d backend postgres

# Espera a que el backend esté sano (máximo ~60s).
for _ in $(seq 1 30); do
  backend_id="$(docker compose ps -q backend 2>/dev/null || true)"
  if [ -n "$backend_id" ] && docker inspect --format='{{.State.Health.Status}}' "$backend_id" 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 2
done

# Stop any existing vite process on 5173
if command -v fuser >/dev/null 2>&1; then
  fuser -k 5173/tcp 2>/dev/null || true
elif command -v pkill >/dev/null 2>&1; then
  pkill -f "vite.*5173" 2>/dev/null || true
fi

sleep 2

cd "$ROOT/frontend"
unset VITE_DEMO
# Forzar el proxy al backend publicado en el host (no a la IP interna del
# contenedor Docker). Esto evita que una VITE_PROXY_TARGET heredada del shell
# rompa las peticiones.
export VITE_PROXY_TARGET=http://localhost:8000
exec npm run dev -- --host 127.0.0.1 --port 5173
