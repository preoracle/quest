"""Map OpenAI-compat / LangChain errors to clean HTTP responses for the API."""

from __future__ import annotations

from fastapi import HTTPException
from openai import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError

_RATE_LIMIT_MSG = (
    "All AI models are rate-limited right now. "
    "Wait a few minutes, or add more API keys in your LLM proxy (freellmapi)."
)


def raise_llm_http_error(exc: BaseException) -> None:
    """Raise HTTPException; never returns."""
    if isinstance(exc, AuthenticationError):
        raise HTTPException(
            status_code=502,
            detail="LLM backend authentication failed — check LLM_API_KEY",
        ) from exc
    if isinstance(exc, RateLimitError):
        raise HTTPException(status_code=429, detail=_RATE_LIMIT_MSG) from exc
    if isinstance(exc, APIConnectionError):
        raise HTTPException(
            status_code=503,
            detail="LLM backend unreachable — check LLM_BASE_URL",
        ) from exc
    if isinstance(exc, APIStatusError):
        if exc.status_code == 429:
            raise HTTPException(status_code=429, detail=_RATE_LIMIT_MSG) from exc
        raise HTTPException(
            status_code=502,
            detail=f"LLM backend error {exc.status_code}",
        ) from exc

    raw = str(exc) or "LLM request failed"
    lowered = raw.lower()
    if (
        "error code: 429" in lowered
        or "rate limit" in lowered
        or "models exhausted" in lowered
        or "routing_error" in lowered
    ):
        raise HTTPException(status_code=429, detail=_RATE_LIMIT_MSG) from exc
    if "<!doctype html" in lowered or "<html" in lowered or "bad gateway" in lowered or " 502" in lowered:
        raise HTTPException(
            status_code=502,
            detail="AI service is temporarily unavailable. Please try again in a moment.",
        ) from exc
    raise HTTPException(status_code=500, detail=raw[:400]) from exc
