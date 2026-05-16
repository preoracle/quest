"""LangChain runnables for Quest.

Phase 1: only the Socratic tutor chain. The Evaluator chain (Phase 2)
and graph-aware chains (Phase 3) land in later commits.

The Socratic prompt itself is the product — keep it in `prompts/socratic.txt`,
never hardcoded here (per BRIEF).
"""

from __future__ import annotations

import os
from pathlib import Path

from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable

_REPO_ROOT = Path(__file__).resolve().parent.parent
_PROMPTS_DIR = _REPO_ROOT / "prompts"

DEFAULT_MODEL = "claude-sonnet-4-6"


def _load_prompt(name: str) -> str:
    """Read a prompt template from `prompts/<name>.txt`.

    Returns the raw template string. Raises FileNotFoundError if the
    prompt file is missing — prompts are not optional, they ARE the product.
    """
    path = _PROMPTS_DIR / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(
            f"Prompt file not found: {path}. "
            f"Prompts must live in prompts/*.txt per BRIEF."
        )
    return path.read_text(encoding="utf-8")


def build_socratic_chain(topic: str) -> Runnable:
    """Build the Socratic tutor chain for a given topic.

    Loads the Socratic system prompt from `prompts/socratic.txt`,
    substitutes the topic into the `{topic}` placeholder, and wraps
    Anthropic Claude Sonnet (configurable via ANTHROPIC_MODEL env var)
    with a MessagesPlaceholder for the running conversation history.

    The chain expects an input dict of the form `{"history": [<messages>]}`
    where messages are LangChain HumanMessage / AIMessage objects.

    Returns a Runnable that produces an AIMessage. The caller is responsible
    for appending the user's turn to history before invoking, and appending
    the AIMessage to history after invoking.
    """
    system_template = _load_prompt("socratic")

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_template),
            MessagesPlaceholder(variable_name="history"),
        ]
    ).partial(topic=topic)

    model = ChatAnthropic(
        model=os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL),
        temperature=0.7,
        max_tokens=512,
    )

    return prompt | model
