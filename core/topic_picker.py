"""Interactive topic selection for the CLI (search-first, scales to many topics)."""

from __future__ import annotations

import sys

from prompt_toolkit.completion import FuzzyWordCompleter
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from core.picker_types import PickerSelection, REPLAY_FLAGS, split_picker_input
from core.topics import list_topics
from core.ui import _make_prompt_session
from db import queries

EXIT_COMMANDS = {":quit", ":q", ":exit", "quit", "exit"}
NEW_COMMANDS = {"new", "n", "+", "create"}
HELP_COMMANDS = {"help", "?"}

# Above this count we never dump the full catalog — search only.
_FULL_LIST_MAX = 12
# Max rows shown per search result page.
_MATCH_LIMIT = 20


def _filter_topics(
    topics: list[tuple[str, str]],
    query: str,
) -> list[tuple[str, str]]:
    """Return topics whose id or display name contains ``query`` (case-insensitive)."""
    q = query.strip().casefold()
    if not q:
        return topics
    return [
        t
        for t in topics
        if q in t[0].casefold() or q in t[1].casefold()
    ]


def _strip_quotes(text: str) -> str:
    """Remove one pair of surrounding single or double quotes."""
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        return text[1:-1].strip()
    return text


def parse_new_command(line: str) -> str | None:
    """If ``line`` starts a create-topic command, return the goal (maybe empty).

    Returns ``None`` when the line is not a create command.

    Examples:
        ``new`` → ``""``
        ``new react hooks`` → ``react hooks``
        ``new "react hooks"`` → ``react hooks``
    """
    line = line.strip()
    if not line:
        return None
    parts = line.split(maxsplit=1)
    verb = parts[0].casefold()
    if verb not in NEW_COMMANDS:
        return None
    if len(parts) == 1:
        return ""
    return _strip_quotes(parts[1])


class TopicPickerUi:
    """Rich + prompt-toolkit UI for the topic catalog."""

    def __init__(self) -> None:
        self.console = Console(soft_wrap=True)
        self._prompt = _make_prompt_session()
        self._completer: FuzzyWordCompleter | None = None

    def _set_completions(self, topics: list[tuple[str, str]]) -> None:
        words = sorted(
            set(HELP_COMMANDS)
            | NEW_COMMANDS
            | EXIT_COMMANDS
            | REPLAY_FLAGS
            | {tid for tid, _ in topics}
            | {f"{tid} --fresh" for tid, _ in topics}
            | {d.casefold() for _, d in topics}
        )
        self._completer = FuzzyWordCompleter(words)

    def render_welcome(self, *, topic_count: int) -> None:
        """Compact branded header; table + toolbar carry the rest."""
        if topic_count == 0:
            body = (
                "[dim]No topics yet. Type [/dim]"
                "[bold #e6c364]new[/bold #e6c364][dim] and your learning goal at the prompt.[/dim]"
            )
        elif topic_count > _FULL_LIST_MAX:
            body = (
                f"[dim]{topic_count} topics — type to search at [/dim][bold #e6c364]›[/bold #e6c364]"
                "[dim], or [/dim][bold #e6c364]new[/bold #e6c364][dim] to create one.[/dim]"
            )
        else:
            body = (
                "[bold #e6c364]What do you want to study?[/bold #e6c364]\n\n"
                "[dim]Type a [/dim][bold #e6c364]number[/bold #e6c364][dim], "
                "[bold #e6c364]topic id[/bold #e6c364][dim], or [/dim]"
                "[bold #e6c364]new your goal[/bold #e6c364][dim].[/dim]\n"
                "[dim]Replay full DAG: append [/dim]"
                "[bold #e6c364]--fresh[/bold #e6c364][dim] "
                "(e.g. [/dim][bold #e6c364]binary_search --fresh[/bold #e6c364][dim])[/dim]"
            )
        self.console.print()
        self.console.print(
            Panel(
                body,
                title="[bold #e6c364] Quest [/bold #e6c364]",
                border_style="#e6c364",
                box=box.ROUNDED,
                padding=(0, 1),
            )
        )
        self.console.print()

    def render_topic_table(self, topics: list[tuple[str, str]], *, title: str = "Topics") -> None:
        """Numbered catalog for small topic lists."""
        if not topics:
            return
        table = Table(
            box=box.MINIMAL_DOUBLE_HEAD,
            show_header=True,
            header_style="dim",
            border_style="dim",
            padding=(0, 0),
            expand=True,
        )
        table.add_column("#", justify="right", style="#e6c364", width=3)
        table.add_column("Topic", ratio=2)
        table.add_column("id", style="dim", ratio=1)
        for idx, (tid, display) in enumerate(topics, start=1):
            table.add_row(str(idx), display, tid)
        self.console.print(
            Panel(
                table,
                title=f"[bold]{title}[/bold]",
                border_style="dim",
                box=box.ROUNDED,
                padding=(0, 1),
            )
        )

    def render_matches(
        self,
        matches: list[tuple[str, str]],
        *,
        total: int | None = None,
    ) -> None:
        """Search results as a compact table."""
        if not matches:
            self.console.print("[dim]  (no matches)[/dim]")
            return
        if total is not None and len(matches) < total:
            self.console.print(
                f"[dim]  showing {len(matches)} of {total} matches[/dim]"
            )
        self.render_topic_table(matches)

    def render_hint(self, message: str) -> None:
        self.console.print(f"[dim]{message}[/dim]")

    def prompt(self, label: str = "› ") -> str:
        """Read one line with history and fuzzy completion."""
        return self._prompt.prompt(
            [("class:prompt", label)],
            completer=self._completer,
            bottom_toolbar=(
                "[#929097]3 · binary_search · id --fresh · new goal · help · quit"
            ),
        ).strip()

    def prompt_yes_no(self, message: str, *, default_no: bool = True) -> bool:
        suffix = " [y/N] " if default_no else " [Y/n] "
        try:
            ans = self._prompt.prompt(
                [("class:prompt", message + suffix)],
            ).strip().lower()
        except (EOFError, KeyboardInterrupt):
            self.console.print()
            return False
        if not ans:
            return not default_no
        return ans in ("y", "yes")


def create_topic_from_goal(
    goal: str,
    *,
    assume_write: bool = False,
    force: bool = False,
    ui: TopicPickerUi | None = None,
) -> str | None:
    """Generate YAML for ``goal``. Returns topic id on success, else None."""
    from core.topic_generator import generate_topic_payload, write_topic_yaml

    ui = ui or TopicPickerUi()
    goal = goal.strip()
    if not goal:
        ui.console.print("[red]Learning goal required.[/red]", file=sys.stderr)
        return None

    with ui.console.status("[dim]Generating concept map (Sonnet)…[/dim]", spinner="dots"):
        try:
            data = generate_topic_payload(goal)
        except Exception as exc:
            ui.console.print(f"[red]Generation failed:[/red] {exc}", file=sys.stderr)
            return None

    ui.console.print(
        f"\n  [dim]topic[/dim]  [bold]{data['topic']}[/bold]\n"
        f"  [dim]title[/dim]  {data['display_name']}\n"
        f"  [dim]concepts[/dim]  {len(data['concepts'])}"
    )

    if not assume_write and not ui.prompt_yes_no("Write topic YAML?", default_no=True):
        ui.console.print("[dim]Aborted.[/dim]")
        return None

    try:
        path = write_topic_yaml(data, force=force)
    except FileExistsError as exc:
        ui.console.print(f"[red]{exc}[/red]", file=sys.stderr)
        ui.console.print("[dim]Use --force to overwrite.[/dim]", file=sys.stderr)
        return None
    except ValueError as exc:
        ui.console.print(f"[red]Invalid map:[/red] {exc}", file=sys.stderr)
        return None

    ui.console.print(f"\n[green]Wrote[/green] {path}")
    from core.topic_lifecycle import mark_topic_user_created

    queries.init_db()
    with queries.get_connection() as conn:
        mark_topic_user_created(conn, data["topic"])
    return data["topic"]


def _resolve_topic(
    topics: list[tuple[str, str]],
    line: str,
) -> PickerSelection | None:
    """Match number, exact id, or single search hit."""
    query, replay, baseline = split_picker_input(line)
    if not query:
        return None

    if query.isdigit() and len(topics) <= _FULL_LIST_MAX:
        i = int(query)
        if 1 <= i <= len(topics):
            return PickerSelection(topics[i - 1][0], replay=replay, baseline=baseline)

    for tid, _ in topics:
        if query == tid:
            return PickerSelection(tid, replay=replay, baseline=baseline)

    filtered = _filter_topics(topics, query)
    if len(filtered) == 1:
        return PickerSelection(filtered[0][0], replay=replay, baseline=baseline)
    return None


def pick_topic_interactive() -> PickerSelection:
    """Pick a topic — Rich catalog by default; arrow wizard if ``QUEST_WIZARD=1``."""
    from core.topic_wizard import run_topic_wizard, wizard_available

    if wizard_available():
        try:
            tid = run_topic_wizard()
            return PickerSelection(tid, replay=False)
        except KeyboardInterrupt:
            raise SystemExit(0) from None

    return _pick_topic_plain()


def _pick_topic_plain() -> PickerSelection:
    """Search-first topic picker; supports ``new`` to create a topic inline."""
    ui = TopicPickerUi()
    topics = list_topics()
    ui._set_completions(topics)
    ui.render_welcome(topic_count=len(topics))

    if not topics:
        while True:
            raw = ui.prompt()
            if raw.casefold() in {c.lstrip(":") for c in EXIT_COMMANDS} or raw in EXIT_COMMANDS:
                raise SystemExit(0)
            new_goal = parse_new_command(raw)
            if new_goal is not None:
                goal = new_goal
                if not goal:
                    goal = ui.prompt("What do you want to learn? › ").strip()
                    if not goal:
                        continue
                tid = create_topic_from_goal(goal, assume_write=False, ui=ui)
                if tid:
                    return PickerSelection(tid, replay=False)
                continue
            ui.render_hint('Type  new <what you want to learn>')
        # unreachable

    if len(topics) <= _FULL_LIST_MAX:
        ui.render_topic_table(topics, title=f"Topics ({len(topics)})")
        ui.console.print(
            "[dim]Bundled catalog[/dim]  ·  "
            "[dim][/dim][bold #e6c364]new …[/bold #e6c364][dim] for your own topic[/dim]\n"
        )

    while True:
        try:
            raw = ui.prompt()
        except (EOFError, KeyboardInterrupt):
            ui.console.print()
            raise SystemExit(0) from None

        if not raw:
            if len(topics) <= _FULL_LIST_MAX:
                ui.render_topic_table(topics)
            else:
                ui.render_hint(f"{len(topics)} topics — type to search, or new")
            continue

        if raw.casefold() in {c.lstrip(":") for c in EXIT_COMMANDS} or raw in EXIT_COMMANDS:
            raise SystemExit(0)

        if raw.casefold() in HELP_COMMANDS:
            ui.console.print(
                "[dim]At ›:[/dim] [bold #e6c364]3[/bold #e6c364][dim] pick #3 · [/dim]"
                "[bold #e6c364]binary_search[/bold #e6c364][dim] by id · [/dim]"
                "[bold #e6c364]binary_search --fresh[/bold #e6c364][dim] replay DAG · [/dim]"
                "[bold #e6c364]TOPIC --baseline[/bold #e6c364][dim] calibrate · [/dim]"
                "[bold #e6c364]new …[/bold #e6c364][dim] create · quit[/dim]\n"
            )
            if len(topics) <= _FULL_LIST_MAX:
                ui.render_topic_table(topics, title=f"Topics ({len(topics)})")
            continue

        new_goal = parse_new_command(raw)
        if new_goal is not None:
            goal = new_goal
            if not goal:
                try:
                    goal = ui.prompt("What do you want to learn? › ").strip()
                except (EOFError, KeyboardInterrupt):
                    ui.console.print()
                    continue
            tid = create_topic_from_goal(goal, assume_write=False, ui=ui)
            if tid:
                return PickerSelection(tid, replay=False)
            continue

        resolved = _resolve_topic(topics, raw)
        if resolved:
            if resolved.replay:
                ui.console.print(
                    f"[dim]Replay mode[/dim] — full DAG for [bold]{resolved.topic_id}[/bold]\n"
                )
            if resolved.baseline:
                ui.console.print(
                    f"[dim]Baseline[/dim] — quick calibration for [bold]{resolved.topic_id}[/bold]\n"
                )
            return resolved

        query, _, _ = split_picker_input(raw)
        filtered = _filter_topics(topics, query)
        if not filtered:
            ui.console.print(f"[yellow]No match[/yellow] for {query!r}")
            ui.render_hint(
                f"Try [bold #e6c364]{query} --fresh[/bold #e6c364] or [bold #e6c364]new {query}[/bold #e6c364]"
            )
            continue

        page = filtered[:_MATCH_LIMIT]
        if len(filtered) > _MATCH_LIMIT:
            ui.render_hint(
                f"{len(filtered)} matches — showing first {_MATCH_LIMIT}; narrow search"
            )

        ui.render_matches(
            page,
            total=len(filtered) if len(filtered) > len(page) else None,
        )
        ui.render_hint("Pick a number or id (optional --fresh), or blank to search again")

        while True:
            try:
                pick = ui.prompt("pick › ").strip()
            except (EOFError, KeyboardInterrupt):
                ui.console.print()
                raise SystemExit(0) from None

            if not pick:
                break
            if pick.casefold() in {c.lstrip(":") for c in EXIT_COMMANDS} or pick in EXIT_COMMANDS:
                raise SystemExit(0)
            resolved = _resolve_topic(page, pick)
            if resolved:
                return resolved
            ui.render_hint(f"Enter 1–{len(page)}, topic id, or id --fresh")
