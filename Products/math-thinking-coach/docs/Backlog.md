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

*Note: this numbering reflects what was actually built. An earlier draft of this backlog had different titles under 008/009 — this file is the corrected, authoritative history.*

---

## Ready

None currently scoped. See "Recommended Next" below.

---

## Future (unscoped / unprioritized)

- Wire coaching UI state — use `coach.nextAction` / `ui.canTryAgain` / `ui.canRevealSolution` / `ui.hintLevel` (already returned by Feature 010) to drive the hint/solution-reveal buttons instead of the current fully-manual flow.
- AI-based answer evaluation (LLM) — replace the exact-match comparison in `answer_service.py` behind the existing API contract; covers the free-text questions where exact-match is weakest.
- Adaptive Hint Engine
- Student Progress History
- Statistics Dashboard
- Teacher Portal
- OCR Question Scanner (Phase 2, per ProductArchitecture.md)
- Voice Input / Voice Explanation (Phase 2)

---

## Recommended Next: Feature 011 — Wire Coaching UI State

Feature 010 already returns everything needed (`coach.nextAction`, `ui.canTryAgain`, `ui.canRevealSolution`, `ui.hintLevel`) but the frontend only reads `coach.message` today; hint/solution reveal is still fully manual. Wiring the existing response into the UI is the smallest, lowest-risk next step — it completes the coaching loop Feature 010 started, requires no new backend work, and should happen before investing in LLM-based evaluation (Phase 2 candidate above) so the rule-based contract is fully exercised and validated first.
