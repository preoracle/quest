#!/usr/bin/env bash
# Run Quest API for local frontend dev (Vite proxies /api -> :8000).
set -euo pipefail
cd "$(dirname "$0")/.."
uv sync --extra api --extra dev --extra postgres
exec uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
