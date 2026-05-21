"""Server-side topic and concept search for the catalog."""

from __future__ import annotations

from core.topic_catalog import list_topic_catalog


def _norm(text: str) -> str:
    return text.casefold().strip()


def _score_row(row: dict, query: str) -> int:
    """Higher is better. Zero means no match."""
    q = _norm(query)
    if not q:
        return 1
    score = 0
    tid = _norm(row["id"])
    name = _norm(row["display_name"])
    hook = _norm(row.get("hook") or "")

    if tid == q:
        score += 1000
    elif tid.startswith(q):
        score += 500
    elif q in tid:
        score += 200

    if name == q:
        score += 800
    elif name.startswith(q):
        score += 400
    elif q in name:
        score += 150

    if q in hook:
        score += 50

    for concept in row.get("preview_concepts") or []:
        c = _norm(str(concept))
        if c == q:
            score += 300
        elif q in c:
            score += 80

    return score


def filter_catalog_rows(
    rows: list[dict],
    *,
    query: str = "",
    include_archived: bool = False,
    archived_ids: set[str] | None = None,
    pinned_ids: set[str] | None = None,
) -> list[dict]:
    """Filter and rank catalog rows for API/CLI."""
    archived = archived_ids or set()
    pinned = pinned_ids or set()
    out: list[dict] = []
    for row in rows:
        if row["id"] in archived and not include_archived:
            continue
        if query.strip():
            if _score_row(row, query) <= 0:
                continue
        enriched = dict(row)
        enriched["archived"] = row["id"] in archived
        enriched["pinned"] = row["id"] in pinned
        enriched["_search_score"] = _score_row(row, query) if query.strip() else 0
        out.append(enriched)

    if query.strip():
        out.sort(
            key=lambda r: (
                -int(r.get("_search_score") or 0),
                -int(r.get("pinned", False)),
                r["display_name"].lower(),
            ),
        )
    else:
        out.sort(
            key=lambda r: (
                -int(r.get("pinned", False)),
                r["display_name"].lower(),
            ),
        )
    for row in out:
        row.pop("_search_score", None)
    return out


def search_topics(
    *,
    query: str = "",
    include_archived: bool = False,
    metadata: dict[str, dict] | None = None,
) -> list[dict]:
    """Search the on-disk topic catalog with metadata overlays."""
    meta = metadata or {}
    archived_ids = {
        tid for tid, m in meta.items() if m.get("archived_at")
    }
    pinned_ids = {tid for tid, m in meta.items() if m.get("pinned_at")}
    rows = list_topic_catalog()
    return filter_catalog_rows(
        rows,
        query=query,
        include_archived=include_archived,
        archived_ids=archived_ids,
        pinned_ids=pinned_ids,
    )


def search_concepts_across_topics(
    query: str,
    *,
    metadata: dict[str, dict] | None = None,
) -> list[dict]:
    """Find concept names matching query across all topics."""
    q = _norm(query)
    if not q:
        return []
    meta = metadata or {}
    archived_ids = {tid for tid, m in meta.items() if m.get("archived_at")}
    hits: list[dict] = []
    for row in list_topic_catalog():
        if row["id"] in archived_ids:
            continue
        for name in row.get("preview_concepts") or []:
            if q in _norm(name):
                hits.append(
                    {
                        "topic_id": row["id"],
                        "topic_display_name": row["display_name"],
                        "concept_name": name,
                    }
                )
    hits.sort(key=lambda h: (h["topic_display_name"].lower(), h["concept_name"].lower()))
    return hits
