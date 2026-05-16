"""Session memory — summaries for cross-session context (Phase 3)."""

from __future__ import annotations

import os
import sqlite3

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from db import queries

DEFAULT_MODEL = "claude-haiku-4-5"


def summarize_session(
    conn: sqlite3.Connection,
    session_id: str,
    topic_display: str,
) -> str:
    """Generate a short session summary from turn history and store it on the session.

    Uses Haiku for a cheap compression pass. Returns the summary text written
  to `sessions.summary_text`.
    """
    turns = queries.get_turns_for_session(conn, session_id)
    if not turns:
        summary = f"Session on {topic_display}: no turns recorded."
        queries.set_session_summary(conn, session_id, summary)
        return summary

    transcript_lines = []
    for t in turns:
        label = "Tutor" if t["role"] == "tutor" else "Student"
        transcript_lines.append(f"{label}: {t['content']}")
    transcript = "\n".join(transcript_lines)

    model = ChatAnthropic(
        model=os.environ.get("ANTHROPIC_EVAL_MODEL", DEFAULT_MODEL),
        temperature=0,
        max_tokens=256,
    )
    response = model.invoke(
        [
            SystemMessage(
                content=(
                    "Summarize this Socratic tutoring session in 3–5 bullet points. "
                    "Note what the student understood and what gaps remain. "
                    "Do not teach or explain new material."
                )
            ),
            HumanMessage(content=f"Topic: {topic_display}\n\n{transcript}"),
        ]
    )
    content = response.content
    if isinstance(content, list):
        summary = "".join(
            p.get("text", "") if isinstance(p, dict) else str(p) for p in content
        )
    else:
        summary = str(content)

    queries.set_session_summary(conn, session_id, summary.strip())
    return summary
