"""Interactive topic selection for the CLI (search-first, scales to many topics)."""

from __future__ import annotations

from core.topics import list_topics

EXIT_COMMANDS = {":quit", ":q", ":exit"}
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


def _print_matches(matches: list[tuple[str, str]], *, total: int | None = None) -> None:
    """Print a numbered slice of matches."""
    if not matches:
        print("  (no matches)")
        return
    if total is not None and len(matches) < total:
        print(f"  showing {len(matches)} of {total} matches")
    for idx, (tid, display) in enumerate(matches, start=1):
        print(f"  {idx:>2}. {display}  ({tid})")


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


def _print_banner(*, topic_count: int) -> None:
    print()
    print("Quest — what do you want to study?")
    print()
    print("  Start an existing topic:")
    print("    7              pick #7 from the list below")
    print("    rag            search by name or id")
    print("    rag_pipeline   exact topic id")
    print()
    print("  Create a new topic:")
    print('    new            asks what you want to learn')
    print('    new react hooks')
    print('    new "react hooks"')
    print()
    print("  help · quit")
    if topic_count == 0:
        print("\nNo topics yet — use:  new <what you want to learn>")
    elif topic_count > _FULL_LIST_MAX:
        print(f"\n{topic_count} topics — search to find one (list not shown).")
    else:
        print(f"\n{topic_count} topics:")


def create_topic_from_goal(
    goal: str,
    *,
    assume_write: bool = False,
    force: bool = False,
) -> str | None:
    """Generate YAML for ``goal``. Returns topic id on success, else None."""
    from core.topic_generator import generate_topic_payload, write_topic_yaml

    goal = goal.strip()
    if not goal:
        print("Learning goal required.", file=sys.stderr)
        return None

    print("\nGenerating concept map (Sonnet)…")
    try:
        data = generate_topic_payload(goal)
    except Exception as exc:
        print(f"Generation failed: {exc}", file=sys.stderr)
        return None

    print(f"  topic id:    {data['topic']}")
    print(f"  title:       {data['display_name']}")
    print(f"  concepts:    {len(data['concepts'])}")

    if not assume_write:
        try:
            ans = input("\nWrite to concepts/? [y/N] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nAborted.")
            return None
        if ans != "y":
            print("Aborted.")
            return None

    try:
        path = write_topic_yaml(data, force=force)
    except FileExistsError as exc:
        print(f"{exc}", file=sys.stderr)
        print("Use --force to overwrite.", file=sys.stderr)
        return None
    except ValueError as exc:
        print(f"Invalid map: {exc}", file=sys.stderr)
        return None

    print(f"\nWrote {path}")
    return data["topic"]


def pick_topic_interactive() -> str:
    """Search-first topic picker; supports ``new`` to create a topic inline."""
    topics = list_topics()
    _print_banner(topic_count=len(topics))

    if not topics:
        while True:
            raw = input("> ").strip()
            if raw in EXIT_COMMANDS:
                raise SystemExit(0)
            new_goal = parse_new_command(raw)
            if new_goal is not None:
                goal = new_goal
                if not goal:
                    try:
                        goal = input("What do you want to learn? ").strip()
                    except (EOFError, KeyboardInterrupt):
                        print("\nAborted.")
                        raise SystemExit(0) from None
                tid = create_topic_from_goal(goal, assume_write=False)
                if tid:
                    return tid
                continue
            print('Type:  new <what you want to learn>')
        # unreachable

    # Small catalogs: show full list once before first prompt.
    if len(topics) <= _FULL_LIST_MAX:
        _print_matches(topics)
        print()

    while True:
        try:
            raw = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n")
            raise SystemExit(0) from None

        if not raw:
            if len(topics) <= _FULL_LIST_MAX:
                _print_matches(topics)
            else:
                print(f"  {len(topics)} topics — type a few letters to search, or `new`")
            continue

        if raw in EXIT_COMMANDS:
            raise SystemExit(0)

        low = raw.casefold()
        if low in HELP_COMMANDS:
            _print_banner(topic_count=len(topics))
            continue

        new_goal = parse_new_command(raw)
        if new_goal is not None:
            goal = new_goal
            if not goal:
                try:
                    goal = input("What do you want to learn? ").strip()
                except (EOFError, KeyboardInterrupt):
                    print("\nAborted.")
                    continue
            tid = create_topic_from_goal(goal, assume_write=False)
            if tid:
                return tid
            continue

        if raw.isdigit() and len(topics) <= _FULL_LIST_MAX:
            i = int(raw)
            if 1 <= i <= len(topics):
                return topics[i - 1][0]

        # Exact topic id
        for tid, _ in topics:
            if raw == tid:
                return tid

        filtered = _filter_topics(topics, raw)
        if not filtered:
            print(f"  No topic matches {raw!r}.")
            print(f'  To create it:  new {raw}')
            print('  Or search again / pick a number from the list.')
            continue

        page = filtered[:_MATCH_LIMIT]
        if len(filtered) > _MATCH_LIMIT:
            print(f"  {len(filtered)} matches (showing first {_MATCH_LIMIT}) — narrow your search")

        if len(page) == 1:
            return page[0][0]

        _print_matches(page, total=len(filtered) if len(filtered) > len(page) else None)
        print("  pick a number, or search again")

        while True:
            try:
                pick = input("  > ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n")
                raise SystemExit(0) from None

            if not pick:
                break
            if pick in EXIT_COMMANDS:
                raise SystemExit(0)
            if pick.isdigit():
                i = int(pick)
                if 1 <= i <= len(page):
                    return page[i - 1][0]
            for tid, _ in page:
                if pick == tid:
                    return tid
            print(f"  Enter 1–{len(page)}, a topic id, or blank to search again.")
            continue
