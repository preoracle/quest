# Quest UI — improvement roadmap

## Screens

| Route | Screen |
|-------|--------|
| `/` | Home |
| `/topics` | Topics catalog + create/import |
| `/baseline/:topicId` | Calibrate (≤5 concepts) |
| `/session/:id` | Study (+ summary when done) |
| `/due` | Review queue |
| `/mastery` | Progress overview + graph drill-down (`?topic=`) |

## Shipped

- [x] Session layout: pinned question + answer; scrollable history only
- [x] Topic actions: Resume / New session / Fresh run / Calibrate
- [x] Create topic: `POST /topics/generate` + Upload YAML `POST /topics/import`
- [x] Baseline: `POST /baseline` + `POST /baseline/{id}/answer`
- [x] Progress summary cards: `GET /users/{id}/progress/summary`
- [x] Concept DAG: `GET /topics/{id}/graph` + SVG on Progress drill-down
- [x] Leave session link, expandable eval in history, home copy for Resume vs New session

## Later

- [ ] Review row opens study focused on that concept (needs `focus_concept_id` in API)
- [ ] Session history timeline chart
- [ ] Baseline optional before first study (prompt on Topics)
