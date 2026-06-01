"""Quest FastAPI application (Phase 4 entry point)."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from db import queries

_DEV_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
]


def _normalize_origin(origin: str) -> str:
    """Strip whitespace and trailing slash — browsers never send a trailing slash."""
    return origin.strip().rstrip("/")


def _cors_origins() -> list[str]:
    """CORS_ORIGINS env var (comma-separated) or dev localhost defaults."""
    raw = os.environ.get("CORS_ORIGINS", "")
    if raw.strip():
        return [_normalize_origin(o) for o in raw.split(",") if o.strip()]
    return _DEV_ORIGINS


def _cors_origin_regex() -> str | None:
    """Optional regex for extra origins (e.g. Vercel preview deployments)."""
    raw = os.environ.get("CORS_ORIGIN_REGEX", "").strip()
    return raw or None


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Load env and initialize the DB without blocking the listen socket."""
    load_dotenv()

    async def _init_db() -> None:
        try:
            await asyncio.to_thread(queries.init_db)
        except Exception:
            logger.exception("Database initialization failed")

    init_task = asyncio.create_task(_init_db())
    yield
    init_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await init_task


app = FastAPI(
    title="Quest",
    description="Socratic tutor API",
    version="0.3.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.api_route("/health", methods=["GET", "HEAD"])
def health() -> dict[str, str]:
    """Liveness check (HEAD for UptimeRobot / Render probes)."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
