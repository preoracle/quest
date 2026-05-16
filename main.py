"""Quest FastAPI application (Phase 4 entry point)."""

from __future__ import annotations

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from api.routes import router
from db import queries


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize SQLite on startup."""
    load_dotenv()
    queries.init_db()
    yield


app = FastAPI(
    title="Quest",
    description="Socratic tutor API",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
