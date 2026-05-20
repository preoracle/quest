"""Arrow-key TUI wizard for choosing or creating a topic."""

from __future__ import annotations

import os
import sys

import questionary
from questionary import Choice, Style

from core.topic_picker import (
    _FULL_LIST_MAX,
    _MATCH_LIMIT,
    _filter_topics,
    create_topic_from_goal,
)
from core.topics import list_topics

# Quest gold + dim (matches session CLI).
WIZARD_STYLE = Style(
    [
        ("question", "bold"),
        ("answer", "fg:#e6c364 bold"),
        ("pointer", "fg:#e6c364 bold"),
        ("highlighted", "fg:#e6c364 bold"),
        ("selected", "fg:#e6c364"),
        ("instruction", "dim"),
        ("text", ""),
        ("separator", "dim"),
        ("qmark", "fg:#e6c364 bold"),
        ("questionmark", "fg:#e6c364 bold"),
    ]
)

_MENU_BROWSE = "browse"
_MENU_CREATE = "create"
_MENU_QUIT = "quit"


def build_topic_choices(topics: list[tuple[str, str]]) -> list[Choice]:
    """Build questionary choices from ``(topic_id, display_name)`` pairs."""
    return [
        Choice(
            title=display,
            value=tid,
            description=tid.replace("_", " "),
        )
        for tid, display in topics
    ]


def _main_menu() -> str | None:
    """First step: browse, create, or quit. Returns menu key or None if quit."""
    choice = questionary.select(
        "What would you like to do?",
        choices=[
            Choice("Browse topics", value=_MENU_BROWSE),
            Choice("Create a new topic", value=_MENU_CREATE),
            Choice("Quit", value=_MENU_QUIT),
        ],
        style=WIZARD_STYLE,
        use_indicator=True,
        use_shortcuts=True,
    ).ask()
    return choice


def _browse_topics(topics: list[tuple[str, str]]) -> str | None:
    """Pick an existing topic via searchable list or search-then-pick."""
    if not topics:
        questionary.print("No topics yet — create one first.")
        return None

    if len(topics) <= _FULL_LIST_MAX:
        questionary.print(
            f"{len(topics)} topics (bundled + your ~/.quest/concepts)"
        )
        picked = questionary.select(
            "Choose a topic (↑↓ move, type to filter)",
            choices=build_topic_choices(topics),
            style=WIZARD_STYLE,
            use_indicator=True,
            use_search_filter=True,
            use_shortcuts=False,  # incompatible with search filter in questionary
        ).ask()
        return picked

    questionary.print(f"{len(topics)} topics — search to narrow the list")
    while True:
        query = questionary.text(
            "Search by name or id (blank = cancel)",
            style=WIZARD_STYLE,
        ).ask()
        if query is None:
            return None
        query = query.strip()
        if not query:
            return None

        filtered = _filter_topics(topics, query)
        if not filtered:
            questionary.print(f"No match for {query!r}. Try again.")
            continue
        if len(filtered) == 1:
            tid, display = filtered[0]
            if questionary.confirm(
                f"Start {display} ({tid})?",
                default=True,
                style=WIZARD_STYLE,
            ).ask():
                return tid
            continue

        page = filtered[:_MATCH_LIMIT]
        filterable = len(page) > 6
        picked = questionary.select(
            f"{len(filtered)} matches — choose one",
            choices=build_topic_choices(page),
            style=WIZARD_STYLE,
            use_indicator=True,
            use_search_filter=filterable,
            use_shortcuts=not filterable,
        ).ask()
        if picked:
            return picked


def _create_topic() -> str | None:
    """Wizard path for ``topic new``."""
    goal = questionary.text(
        "What do you want to learn?",
        style=WIZARD_STYLE,
    ).ask()
    if goal is None:
        return None
    goal = goal.strip()
    if not goal:
        questionary.print("Learning goal required.")
        return None

    questionary.print("Generating concept map (Sonnet)…")
    return create_topic_from_goal(goal, assume_write=False)


def run_topic_wizard() -> str:
    """Run the full wizard; returns topic id to start a session.

    Raises ``SystemExit(0)`` when the user quits.
    """
    topics = list_topics()

    while True:
        action = _main_menu()
        if action is None or action == _MENU_QUIT:
            raise SystemExit(0)

        if action == _MENU_CREATE:
            tid = _create_topic()
            if tid:
                return tid
            continue

        if action == _MENU_BROWSE:
            tid = _browse_topics(topics)
            if tid:
                display = next((d for t, d in topics if t == tid), tid)
                if questionary.confirm(
                    f"Start session on {display}?",
                    default=True,
                    style=WIZARD_STYLE,
                ).ask():
                    return tid
            continue


def wizard_available() -> bool:
    """True when arrow-key wizard is opted in (``QUEST_WIZARD=1``) and TTY."""
    if os.environ.get("QUEST_WIZARD", "").strip() not in ("1", "true", "yes"):
        return False
    return sys.stdin.isatty() and sys.stdout.isatty()
