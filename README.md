# Quest

Socratic AI tutor — **no explanations**, only the next better question. Separate evaluator, concept DAGs, mastery tracking, resumable sessions.

```bash
pip install quest-ai
export ANTHROPIC_API_KEY=sk-ant-...
quest
```

## Quick start

| Command | What it does |
|---------|----------------|
| `quest` | Pick a topic and start (or resume) a session |
| `quest topic new "your goal"` | Generate a new concept map (LLM) |
| `quest TOPIC --fresh` | Replay the DAG without SM-2 “already done” skip |
| `quest mastery` | Show mastery scores |
| `quest reset` | Wipe progress (YAML topics stay) |

Data lives in `~/.quest/` when installed (`quest.db`, user topics, checkpoints). In a git checkout, data stays in the repo root.

## vs “just use ChatGPT”

Quest is built for **learning**, not chatting: the tutor is constrained not to teach; understanding is scored by a separate model; topics are structured as prerequisite graphs; progress persists across sessions.

## Docs

- [Product brief](docs/BRIEF.md)
- [Roadmap](docs/ROADMAP.md)
- [Phases / architecture](docs/PHASES.md)

## Development

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # ANTHROPIC_API_KEY
pytest
python cli.py
```

## License

TBD — confirm before PyPI publish.
