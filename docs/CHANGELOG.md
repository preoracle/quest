# Changelog

## 0.1.1 (2026-05-20)

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
