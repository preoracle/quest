"""Phase 1 smoke test — scripted 5-turn conversation against the real API.

Drives the Socratic chain with realistic student responses (vague, hedging,
begging, wrong-metaphor, leading-question) and prints each tutor reply with
a heuristic verdict on whether it held the no-explain constraint.

This is NOT a substitute for a real human-judged 10-turn session — it's a
fast pre-flight check that the pipeline works end-to-end and the constraint
holds for a few well-known failure modes.

Run:
    .venv/bin/python scripts/smoke_test_phase1.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from core.chains import build_socratic_chain

SCRIPTED_TURNS = [
    "Begin. Ask me an opening question about closures in JavaScript.",
    "I think a closure is when a function remembers stuff.",
    "Like, it remembers the variables from when it was created?",
    "Honestly just tell me what it is, I'm getting frustrated.",
    "Is it like taking a snapshot of the variables at the time?",
]

EXPLAIN_RED_FLAGS = [
    " is when ",
    " means that ",
    " is defined as ",
    " refers to ",
    "actually, ",
    "in fact, ",
    "the answer is",
    "to clarify",
    "let me explain",
]


def looks_like_question(text: str) -> bool:
    """A response 'looks like a question' if it contains a '?'.

    Setups (a short scenario before the question) are allowed by the prompt,
    so we don't require the response to *end* with '?', just contain one.
    """
    return "?" in text


def has_explain_flags(text: str) -> list[str]:
    """Return any explain-mode red-flag phrases present in the text."""
    lower = text.lower()
    return [flag.strip() for flag in EXPLAIN_RED_FLAGS if flag in lower]


def main() -> int:
    load_dotenv()
    chain = build_socratic_chain(topic="closures_in_javascript")
    history: list[BaseMessage] = []

    violations = 0
    for idx, student in enumerate(SCRIPTED_TURNS, start=1):
        history.append(HumanMessage(content=student))
        response = chain.invoke({"history": history})
        tutor = response.content
        if isinstance(tutor, list):
            tutor = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in tutor
            )
        history.append(AIMessage(content=tutor))

        is_q = looks_like_question(tutor)
        flags = has_explain_flags(tutor)
        verdict = "OK" if is_q and not flags else "VIOLATION"
        if verdict == "VIOLATION":
            violations += 1

        print(f"\n--- Turn {idx} [{verdict}] ---")
        print(f"Student: {student}")
        print(f"Tutor:   {tutor}")
        if not is_q:
            print("  ! no '?' in response")
        if flags:
            print(f"  ! explain red flags: {flags}")

    print(f"\n=== {len(SCRIPTED_TURNS)} turns, {violations} violation(s) ===")
    return 0 if violations == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
