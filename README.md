# Quest

Socratic AI tutor — **no explanations**, only the next better question. Separate evaluator, concept DAGs, mastery tracking, resumable sessions.

**Requires Python 3.11+** · **Author:** [yuvrxj](https://pypi.org/user/yuvrxj/)

```bash
pip install -U quest-ai
mkdir -p ~/.quest
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> ~/.quest/.env
quest
```

**Upgrade** (same command; your `~/.quest/` data is kept):

```bash
pip install -U quest-ai
pip show quest-ai    # confirm version
```

Use the same environment where you installed Quest (venv: `.venv/bin/pip install -U quest-ai`).

## Quick start

| Command | What it does |
|---------|----------------|
| `quest` | Topic catalog → pick or search → session |
| `quest TOPIC` | Start or resume a topic |
| `quest TOPIC --fresh` | New session, replay full concept DAG |
| `quest TOPIC --baseline` | Calibrate mastery, then study |
| `quest topic new "your goal"` | Generate a concept map (LLM) |
| `quest mastery` | Mastery scores |
| `quest due` | Concepts due for review (SM-2) |
| `quest due --json` | Same, JSON output |
| `quest --version` | Installed package version |
| `quest reset` | Wipe progress (topic YAMLs stay) |

At the catalog prompt: `3`, `rag_pipeline`, `rag_pipeline --fresh`, `new react hooks`, `help`, `quit`.

Installed data lives in `~/.quest/` (`quest.db`, checkpoints, custom topics). In a git checkout, data stays beside `cli.py`.

## How sessions work

1. You pick a **topic** (bundled catalog or `quest topic new`).
2. Quest selects a **concept** from a prerequisite graph (mastery + spaced repetition).
3. **Tutor** asks one Socratic question → you answer → **evaluator** scores that answer (1–5).
4. Repeat on the same concept until mastery (≥4 on three turns), then next concept.
5. `/quit` pauses; run `quest TOPIC` again to resume.

**Memory:** the tutor sees your full Q↔A on the **current concept**. The evaluator scores **only the latest question and answer** (`/last` in-session for detail).

## vs “just use ChatGPT”

Quest is for **learning**: the tutor does not teach; a separate model scores you; topics are structured graphs; progress persists across sessions.

## Links (GitHub)

Use these **absolute** URLs — PyPI cannot serve files under `docs/` on the package page.

- [User guide](https://github.com/preoracle/quest/blob/main/docs/PRODUCT.md)
- [Changelog](https://github.com/preoracle/quest/blob/main/docs/CHANGELOG.md)
- [Repository](https://github.com/preoracle/quest)

## Development

```bash
git clone https://github.com/preoracle/quest.git
cd quest
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
pytest
python cli.py
```

Optional: `QUEST_WIZARD=1 quest` for arrow-key menus instead of the Rich catalog.

**Evaluator mode** (default `last_turn`; optional `concept_thread`):

```bash
QUEST_EVAL_MODE=concept_thread quest TOPIC
```

**Publish to PyPI** (token in `.env` as `PYPI_TOKEN` or exported in shell):

```bash
chmod +x scripts/publish_pypi.sh
./scripts/publish_pypi.sh          # build + upload
./scripts/publish_pypi.sh --check  # build + validate only
```

## Web UI (Phase C)

**One command** (API + UI; opens browser):

```bash
chmod +x scripts/dev_web.sh
./scripts/dev_web.sh
```

**Or two terminals** — `uvicorn` blocks the shell, so do not paste API + UI in one block:

```bash
# Terminal 1 — API only
source .venv/bin/activate
pip install -e ".[api]"
uvicorn main:app --reload
```

```bash
# Terminal 2 — UI only
cd frontend && npm install && npm run dev
```

| URL | What |
|-----|------|
| http://localhost:5173 | **Quest UI** (home, topics, study sessions) |
| http://127.0.0.1:8000/docs | API docs only — not the app |

Requires `ANTHROPIC_API_KEY` in `.env` or `~/.quest/.env` for sessions.

Internal design notes: [BRIEF](https://github.com/preoracle/quest/blob/main/docs/BRIEF.md) · [PHASES](https://github.com/preoracle/quest/blob/main/docs/PHASES.md)
