# Quest

Socratic AI tutor — **no explanations**, only the next better question. Separate evaluator, concept DAGs, mastery tracking, resumable sessions.

**Requires Python 3.11+**

```bash
pip install -U quest-ai
mkdir -p ~/.quest
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> ~/.quest/.env
quest
```

## Quick start

| Command | What it does |
|---------|----------------|
| `quest` | Topic catalog → pick or search → session |
| `quest TOPIC` | Start or resume a topic |
| `quest TOPIC --fresh` | New session, replay full concept DAG |
| `quest topic new "your goal"` | Generate a concept map (LLM) |
| `quest mastery` | Mastery scores |
| `quest reset` | Wipe progress (topic YAMLs stay) |

At the catalog prompt: `3`, `rag_pipeline`, `rag_pipeline --fresh`, `new react hooks`, `help`, `quit`.

Data when installed: `~/.quest/` (`quest.db`, checkpoints, your topics). In a git checkout, data stays beside `cli.py`.

## How scoring works

The **evaluator** scores your **latest answer** to the **latest question** (see `/last` in a session). The **tutor** sees the full back-and-forth **on the current concept** so follow-up questions can build on what you said.

## vs “just use ChatGPT”

Quest is for **learning**: tutor does not teach; a separate model scores you; topics are prerequisite graphs; progress persists with SM-2 scheduling.

## Docs

- [Product snapshot](docs/PRODUCT.md)
- [Changelog](docs/CHANGELOG.md)
- [Brief](docs/BRIEF.md)
- [Roadmap](docs/ROADMAP.md)

## Development

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
pytest
python cli.py
```

Optional: `QUEST_WIZARD=1 quest` for arrow-key menus instead of the Rich catalog.

## Author

[yuvrxj](https://pypi.org/user/yuvrxj/) — PyPI package `quest-ai`.
