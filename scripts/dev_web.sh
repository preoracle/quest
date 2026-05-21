#!/usr/bin/env bash
# Run Quest API + Vite UI together. UI: http://localhost:5173  API: http://127.0.0.1:8000
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  echo "Create .venv first: python3.12 -m venv .venv && .venv/bin/pip install -e '.[api]'" >&2
  exit 1
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "Installing frontend deps…"
  (cd frontend && npm install)
fi

API_PID=""
UI_PID=""
cleanup() {
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$UI_PID" ]] && kill "$UI_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting API on http://127.0.0.1:8000"
.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
API_PID=$!

for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

echo "Starting UI on http://localhost:5173"
(cd frontend && npm run dev) &
UI_PID=$!

sleep 2
if command -v open >/dev/null 2>&1; then
  open "http://localhost:5173" || true
fi

echo ""
echo "  UI:  http://localhost:5173   ← Quest web app"
echo "  API: http://127.0.0.1:8000/docs"
echo ""
echo "Press Ctrl+C to stop both."
wait
