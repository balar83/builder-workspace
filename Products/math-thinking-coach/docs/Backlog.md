# Product Backlog

## Completed

### Feature 007 — Backend Foundation (FastAPI)
FastAPI app skeleton, health check, `/api/v1` versioning, CORS, config, logging.

### Feature 008 — Frontend Service Layer
Introduced `questionService` so components stop importing static data directly (still backed by local data at this point).

### Feature 009 — Question Retrieval API
`GET /api/v1/chapters`, `GET /api/v1/chapters/{chapterId}`, `GET /api/v1/chapters/{chapterId}/questions`, `GET /api/v1/chapters/{chapterId}/questions/{questionId}`. Frontend `questionService` switched to real HTTP calls; local static data files removed.

### Feature 010 — Answer Evaluation API (Rule-Based)
`POST /api/v1/questions/{questionId}/answer`. Deterministic exact-match (trimmed) evaluation, attempt-based coaching messages, `nextAction`/`ui` state contract. Frontend `submitAnswer` wired in; `coach.message` surfaced in the UI, other response fields reserved for a future feature.

### Feature 011 — Wire Coaching UI State
Wired `coach.nextAction` from the existing Feature 010 response into `QuestionPage`, no backend changes. Scope was narrowed via clarifying questions before implementation: a correct answer (`NEXT_QUESTION`) now shows an explicit "Next Question" button instead of requiring hints/solution to be revealed to advance; a second wrong attempt (`SHOW_HINT`) adds a visual nudge (`hint-button-suggested`) to the existing hint button. Hint reveal stays fully self-service (nudge only, not a hard gate) and solution reveal is untouched (still gated by all hints revealed, not by `ui.canRevealSolution`).

*Note: this numbering reflects what was actually built. An earlier draft of this backlog had different titles under 008/009 — this file is the corrected, authoritative history.*

---

## Ready

None currently scoped. See "Recommended Next" below.

---

## Future (unscoped / unprioritized)

- AI-based answer evaluation (LLM) — replace the exact-match comparison in `answer_service.py` behind the existing API contract; covers the free-text questions where exact-match is weakest.
- Adaptive Hint Engine
- Student Progress History
- Statistics Dashboard
- Teacher Portal
- OCR Question Scanner (Phase 2, per ProductArchitecture.md)
- Voice Input / Voice Explanation (Phase 2)

---

## Recommended Next: AI-Based Answer Evaluation (unscoped)

Replace the exact-match comparison in `answer_service.py` with an LLM-based evaluator, behind the same `POST /api/v1/questions/{questionId}/answer` contract that Features 010/011 established — the extension point the rule-based evaluator was deliberately built for (see ProductArchitecture.md §7). It directly addresses the known Phase-1 limitation where free-text questions (e.g. quadrilateral properties) only accept one exact phrasing. Not yet scoped: model choice, prompt design, and latency/cost trade-offs need product-direction approval before implementation starts.
