# Changelog

## 0.3.0 (2026-05-20)

### Phase B complete
- **Baseline assessment** — `quest TOPIC --baseline` probes up to 5 concepts, seeds mastery, then starts study.
- **Dialogue modes** — `QUEST_EVAL_MODE=last_turn` (default) or `concept_thread` for evaluator context.
- Golden fixtures expanded (6 cases); `sessions.session_kind` (`study` | `baseline`).

## 0.2.0 (2026-05-20)

### Features
- **Session report** — end-of-session table: concepts, scores, gaps (+ optional narrative notes).
- **`quest due`** — list concepts due for SM-2 review (`quest due [TOPIC]`, `--json`).
- **Cross-session memory** — prior session summaries shape new opening questions on the same topic.
- **`quest --version`** — print installed `quest-ai` version.

### Quality
- Golden evaluator fixtures in `tests/fixtures/evaluator/` for CI without live API.
- DB migration: `sessions.report_json` for structured reports.

### Docs
- README upgrade + new commands; Phase B plan in `docs/PHASE_B_PLAN.md`.

## 0.1.1 (2026-05-20)

### Docs / PyPI
- README is the PyPI project description; doc links use full GitHub URLs (relative `docs/…` links 404 on pypi.org).
- Project links: Documentation → README; Changelog → GitHub; Roadmap removed from install-facing README.
- Upload fix: drop `LicenseRef-Proprietary` (PyPI 400); use Trove classifier `License :: Other/Proprietary License` like 0.1.0.

### Fixes
- Tutor conversation history now includes your real answers (no more meta “what was the student’s last answer?”).
- Picker accepts `topic_id --fresh` / `--replay` at the `›` prompt.
- API key loads from `~/.quest/.env` when installed from PyPI.
- `db/schema.sql` bundled in the wheel.

### CLI / UX
- Rich topic catalog (default); optional arrow wizard via `QUEST_WIZARD=1`.
- Session UI: You → score line → Question (markdown rendering, scope inside panel).
- Clear replay hint in catalog; improved help text.

### Packaging
- Dependency: `questionary` for optional wizard.
- PyPI maintainer metadata: `yuvrxj`.

## 0.1.0 (2026-05-20)

- Initial PyPI release: `quest-ai`, `quest` CLI, bundled topics, LangGraph sessions.
