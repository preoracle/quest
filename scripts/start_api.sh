#!/usr/bin/env sh
# Production API entrypoint (Render, Docker, etc.)
# Render sets PORT; default 8000 for local Docker Compose.
set -eu
PORT="${PORT:-8000}"
exec uv run uvicorn main:app --host 0.0.0.0 --port "$PORT"
