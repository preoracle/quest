"""Serialize LangChain messages for graph checkpoints."""

from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage


def messages_to_dicts(messages: list[BaseMessage]) -> list[dict[str, str]]:
    """Convert messages to JSON-serializable dicts for LangGraph state."""
    out: list[dict[str, str]] = []
    for m in messages:
        role = "human" if isinstance(m, HumanMessage) else "ai"
        content = m.content
        if isinstance(content, list):
            text = "".join(
                p.get("text", "") if isinstance(p, dict) else str(p) for p in content
            )
        else:
            text = str(content)
        out.append({"role": role, "content": text})
    return out


def messages_from_dicts(data: list[dict[str, str]]) -> list[BaseMessage]:
    """Restore messages from checkpoint-friendly dicts."""
    out: list[BaseMessage] = []
    for item in data:
        if item["role"] == "human":
            out.append(HumanMessage(content=item["content"]))
        else:
            out.append(AIMessage(content=item["content"]))
    return out


def message_content(msg: BaseMessage | Any) -> str:
    """Normalize message content to a plain string."""
    content = msg.content if hasattr(msg, "content") else str(msg)
    if isinstance(content, list):
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content)
