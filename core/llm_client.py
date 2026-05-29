"""Single factory for all Quest LLM calls (freellmapi / OpenAI-compat proxy)."""

from __future__ import annotations

import os

from langchain_openai import ChatOpenAI

DEFAULT_MODEL = "auto"

# Model env fallback chains (first set var wins). All chains share LLM_BASE_URL + LLM_API_KEY.
MODEL_CHAIN_TUTOR = ("LLM_MODEL", "LLM_EVAL_MODEL")
MODEL_CHAIN_EVAL = ("LLM_EVAL_MODEL", "LLM_MODEL")
MODEL_CHAIN_TOPIC = ("LLM_TOPIC_MODEL", "LLM_EVAL_MODEL", "LLM_MODEL")
MODEL_CHAIN_SUMMARIZER = ("LLM_SUMMARIZER_MODEL", "LLM_EVAL_MODEL", "LLM_MODEL")


def llm_base_url() -> str:
    return os.environ.get("LLM_BASE_URL", "http://localhost:3001/v1").rstrip("/")


def llm_api_key() -> str:
    return os.environ.get("LLM_API_KEY", "freellmapi-dev")


def resolve_model(*env_keys: str, default: str = DEFAULT_MODEL) -> str:
    """Return the first non-empty model id from env_keys, else default."""
    for key in env_keys:
        if val := os.environ.get(key, "").strip():
            return val
    return default


def make_chat_model(
    *model_env_keys: str,
    default: str = DEFAULT_MODEL,
    **kwargs,
) -> ChatOpenAI:
    """Build ChatOpenAI pointed at the configured proxy with unified routing."""
    max_retries = kwargs.pop("max_retries", 3)
    return ChatOpenAI(
        model=resolve_model(*model_env_keys, default=default),
        base_url=llm_base_url(),
        api_key=llm_api_key(),
        max_retries=max_retries,
        **kwargs,
    )
