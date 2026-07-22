# Development Journal

## 2026-07-22

### Features completed
- Implemented the FastAPI backend foundation (health check, API versioning, CORS, config, logging).
- Introduced a `questionService` frontend service layer so components no longer access question/chapter data directly.
- Connected the frontend to the backend: implemented `GET /api/v1/chapters`, `GET /api/v1/chapters/{chapterId}`, `GET /api/v1/chapters/{chapterId}/questions`, and `GET /api/v1/chapters/{chapterId}/questions/{questionId}`, and rewired `questionService` to call them over HTTP instead of reading local static data.
- Implemented the first version of the Answer Evaluation API: `POST /api/v1/questions/{questionId}/answer`, rule-based (exact match, trimmed) with attempt-based coaching messages and UI state, establishing the contract future AI-based evaluation will fill in.
- Wired the Feature 010 coaching contract into `QuestionPage` (Feature 011): a correct answer (`coach.nextAction === 'NEXT_QUESTION'`) now shows an explicit "Next Question" button instead of requiring hints/solution to be revealed first, and a second wrong attempt (`SHOW_HINT`) adds a visual nudge to the existing hint button. No backend or API changes.

### Major engineering decisions
- Chapter and question data now lives once, as JSON under `backend/app/data/`, and is the single source of truth for both the API and the frontend (reached via HTTP). The frontend's former `src/data/chapters.ts` and `questions.ts` were removed as dead code once the service switched to fetching from the backend.
- `questionService` methods became async (`Promise`-returning) to support real HTTP calls. This required updating `ChapterSelectionPage`, `ChapterPage`, and `QuestionPage` to load data via `useEffect`/`useState` instead of calling the service synchronously during render — a deliberate, minimal exception to "don't change components," confirmed with the user before implementing, since a purely synchronous service could not wrap real network calls.
- Added a single frontend API configuration point (`src/config/api.ts`, backed by the `VITE_API_BASE_URL` env var) so the backend URL is never hard-coded in the service.
- The `Question` domain model has no field for a comparable short answer (only a full-sentence `solution`), so a private `backend/app/data/answer_keys.json` (questionId → expected answer) was added, read only by `answer_service.py`. It is deliberately kept out of the `Question`/`QuestionRecord` schema tree so the existing chapter/question GET endpoints can never leak it. Canonical answers for the handful of free-text questions (e.g. quadrilateral properties) were derived by judgment from the existing `solution` text; exact-string matching is a known Phase-1 limitation for those questions.
- Feature 011's scope was deliberately narrowed via clarifying questions before implementation, rather than wiring the full `ui` state contract literally: hint reveal stays fully self-service (a suggestion nudge, not a hard gate tied to `ui.hintLevel`), solution reveal is untouched (still gated by all hints revealed, not by `ui.canRevealSolution`), and answer submission stays always-enabled (no new disabling logic tied to `ui.canTryAgain`). Only the correct-answer path changes behavior — this keeps the change low-risk and reversible while still closing the gap Feature 010 deliberately deferred.

### Verification summary
- Backend: `pytest` (9 tests, later 16 with answer evaluation) and a live `uvicorn` smoke test of all endpoints, including 404 cases.
- Frontend: `tsc -b && vite build`, `oxlint`, and `vitest` (16 tests, later 18 with `submitAnswer`) all pass.
- Full manual browser walkthrough with both servers running: chapter list, chapter detail, question navigation, hints, solution reveal, 404 handling for an unknown chapter, and the full answer-evaluation flow (correct answer, and incorrect attempts 1/2/3 producing the correct coaching message each time) — all verified against the real backend with no console errors, and hint/solution reveal confirmed unaffected.
- Feature 011: backend untouched, still 20/20 pytest. Frontend `tsc -b && vite build`, `oxlint`, and `vitest` (18/18, no new tests needed — no new component boundaries introduced) all pass. Live browser walkthrough: first wrong attempt shows no nudge, second wrong attempt applies the `hint-button-suggested` class (confirmed via DOM inspection), correct answer shows "Next Question" and advances to the next question with a clean state reset, and the manual hint-through-to-solution path was regression-checked and confirmed unchanged.

### Implementation notes
- Kept the async page-loading additions minimal (a `cancelled` flag per effect to avoid setting state after unmount/param change); no new loading UI or styling was introduced, so a brief transient "not found" state can flash during the network round trip before data arrives.
- `QuestionPage` now tracks `attemptNumber` and calls `submitAnswer` on the existing "Check Answer" button; only `coach.message` was surfaced, in the same paragraph slot that previously showed a static "will be available after backend integration" placeholder. `evaluation.isCorrect/score`, `coach.nextAction`, and all of `ui` are captured in state but not yet wired to any UI behavior (no auto-advance, no gated hint/solution reveal) — reserved for a future feature rather than forcing new UI work into this one.
- Feature 011 reads `evaluation.coach.nextAction` directly (`isCorrectAnswer`, `isHintSuggested` derived values in `QuestionPage`) rather than introducing new component state; the existing "Chapter Complete" / "Mark Question Complete" block was merged with the new correct-answer path (`questionEnded = isCorrectAnswer || showSolution`) instead of duplicating that markup for a separate "Next Question" branch.

## 2026-07-09

### Features completed
- Implemented multi-question chapters with five questions per chapter.
- Added question navigation with a Question X of Y indicator and chapter-complete flow.
- Added student answer capture with a reusable AnswerInput component and submission feedback.
- Added a reusable QuestionProgress component showing completed, current, and remaining questions.

### Major engineering decisions
- Kept the existing routing and architecture intact while extending the question experience.
- Followed a reusable component approach for the hint, solution, answer input, and progress UI.
- Kept data changes inside the existing src/data structure without introducing new app-level architecture.

### Verification summary
- Verified all completed work with Build, Lint, and Tests.
- Confirmed the frontend remains stable after the new question-flow and UI components were added.

### Implementation notes
- The hint, solution, and answer-entry flows were preserved as separate UI concerns to keep the experience understandable and maintainable.
- Documentation was audited and aligned with the current application implementation and backlog priority.
