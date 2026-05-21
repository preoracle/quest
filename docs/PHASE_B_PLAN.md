# Phase B plan — product gaps after 0.1.x ship

**Status:** **Complete** in repo as **0.3.0**. Publish: `./scripts/publish_pypi.sh`.

**Goal:** Turn the working learning loop into a product people return to — clear end-of-session insight, visible review queue, CI quality gates, smarter cold start.

---

## How users upgrade the CLI (pip, not Homebrew)

```bash
pip install -U quest-ai
quest --version
```

User data in `~/.quest/` is kept across upgrades.

---

## Workstreams — all delivered

### B1 — Structured session report ✅

- `core/session_report.py`, `sessions.report_json`, Rich table at session end.

### B2 — `quest due` ✅

- `get_due_concepts`, `quest due`, `quest due --json`.

### B3 — Golden eval fixtures ✅

- `tests/fixtures/evaluator/` (6 YAML cases), `test_evaluator_golden.py`.

### B4 — Cross-session memory ✅

- `get_recent_summaries` in opening tutor steer.

### B5 — Baseline assessment ✅

- `quest TOPIC --baseline` (catalog: `TOPIC --baseline`).
- `core/baseline.py` — up to 5 probes, seeds mastery, then study.
- `sessions.session_kind`: `baseline` | `study`.

### B6 — Dialogue modes ✅

- `QUEST_EVAL_MODE=last_turn|concept_thread`.
- `core/eval_context.py`, evaluator prompt `scoring_scope`.

### C-lite ✅

- `quest --version`, README upgrade section, publish script.

---

## Tracking

| ID | Item | Status |
|----|------|--------|
| B1 | Session report | Done (0.2.0) |
| B2 | `quest due` | Done (0.2.0) |
| B3 | Eval fixtures | Done (0.2.0+) |
| B4 | Cross-session memory | Done (0.2.0) |
| B5 | Baseline assessment | Done (0.3.0) |
| B6 | Dialogue modes | Done (0.3.0) |
| C-lite | Upgrade docs + `--version` | Done |

---

## Release checklist

1. `pytest`
2. `./scripts/publish_pypi.sh`
3. Tell users: `pip install -U quest-ai`
