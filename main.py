"""Quest CLI entry point.

Phase 1: a REPL where the user picks a topic from `concepts/*.yaml` and
holds a Socratic conversation with Claude Sonnet. Turn history lives in
memory only — persistence lands in Phase 2.

Usage:
    python main.py                  # interactive topic picker
    python main.py <topic_id>       # skip picker, e.g. closures_in_javascript

Type `:quit` or `:q`, or send EOF / Ctrl-C, to exit gracefully.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from core.chains import build_socratic_chain

_REPO_ROOT = Path(__file__).resolve().parent
_CONCEPTS_DIR = _REPO_ROOT / "concepts"

EXIT_COMMANDS = {":quit", ":q", ":exit"}


def list_topics() -> list[tuple[str, str]]:
    """Return [(topic_id, display_name), ...] for every concept YAML on disk.

    Returns an empty list if `concepts/` is missing or contains no .yaml files.
    """
    if not _CONCEPTS_DIR.exists():
        return []
    out: list[tuple[str, str]] = []
    for path in sorted(_CONCEPTS_DIR.glob("*.yaml")):
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        topic_id = data.get("topic") or path.stem
        display = data.get("display_name") or topic_id.replace("_", " ").title()
        out.append((topic_id, display))
    return out


def load_topic(topic_id: str) -> dict:
    """Load a single concept YAML by topic id (filename stem).

    Returns the parsed dict. Raises FileNotFoundError with a helpful
    message listing available topics if the file is missing.
    """
    path = _CONCEPTS_DIR / f"{topic_id}.yaml"
    if not path.exists():
        available = [tid for tid, _ in list_topics()]
        raise FileNotFoundError(
            f"No concept map for '{topic_id}'. "
            f"Available: {available or '(none — add a YAML to concepts/)'}"
        )
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def pick_topic_interactive() -> str:
    """Show numbered topic list, read user choice, return topic id.

    Raises SystemExit if there are no topics or the user cancels.
    """
    topics = list_topics()
    if not topics:
        print("No concept YAMLs found in concepts/. Add one and retry.")
        raise SystemExit(1)

    print("\nPick a topic:")
    for idx, (_, display) in enumerate(topics, start=1):
        print(f"  {idx}. {display}")
    print()

    while True:
        raw = input("> ").strip()
        if not raw:
            continue
        if raw in EXIT_COMMANDS:
            raise SystemExit(0)
        if raw.isdigit():
            i = int(raw)
            if 1 <= i <= len(topics):
                return topics[i - 1][0]
        for tid, _ in topics:
            if raw == tid:
                return tid
        print(f"Pick a number 1–{len(topics)} or a topic id.")


def run_session(topic_id: str) -> None:
    """Run the Socratic REPL on `topic_id` until the user exits.

    Builds the chain once, keeps history in a local list, and invokes
    the chain after each user turn. No persistence in Phase 1.
    """
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id

    print(f"\nQuest — topic: {display}")
    print("Type your responses. Send `:q` to exit.\n")

    chain = build_socratic_chain(topic=topic_id)
    history: list[BaseMessage] = []

    print("(opening question...)")
    history.append(HumanMessage(content="Begin. Ask me an opening question."))
    opening = chain.invoke({"history": history})
    history.append(AIMessage(content=opening.content))
    print(f"\nTutor: {opening.content}\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nSession ended.")
            return

        if not user_input:
            continue
        if user_input in EXIT_COMMANDS:
            print("\nSession ended.")
            return

        history.append(HumanMessage(content=user_input))
        try:
            response = chain.invoke({"history": history})
        except Exception as exc:
            print(f"\n[chain error: {exc}]\n")
            history.pop()
            continue

        history.append(AIMessage(content=response.content))
        print(f"\nTutor: {response.content}\n")


def main(argv: list[str]) -> int:
    """CLI entry point. Returns a process exit code."""
    load_dotenv()

    if len(argv) > 1:
        topic_id = argv[1]
    else:
        topic_id = pick_topic_interactive()

    try:
        run_session(topic_id)
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
