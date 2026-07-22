# Development Journal

## 2026-07-22 (Feature 014 — Local AI Evaluation Spike)

### Features completed
- Built an isolated AI evaluation playground at `backend/experiments/ai_evaluation/`, following an architecture review (Feature 013, design-only, not committed to the repo) that recommended a shadow-mode-first path toward AI-based answer evaluation. Nothing in this directory is imported by `app/*`; `evaluation_service.py`, `coaching_service.py`, `answer_service.py`, the API contract, and the frontend were not touched.
- Components: `ollama_client.py` (a ~20-line `httpx`-based wrapper around Ollama's `/api/generate`, deterministic settings — `temperature=0`, fixed seed; `httpx` was already a project dependency, so no new dependency was added), `schema.py` (an experimental `AIEvaluation` Pydantic model — correctness, confidence, reasoning_quality, misconception_tags, explanation — separate from `app/schemas/answer.py`), `prompt.py` (a first-cut, unoptimized evaluation prompt), `dataset.json` (30 hand-labeled student-answer samples built from the real 25 questions in `app/data/questions.json`, spanning five categories), and `run_harness.py` (a standalone script — not a web API, not part of FastAPI — that loads the real question/answer-key data read-only, calls the model once per sample, validates the response, and writes results to `results/`).
- Ran the full 30-sample harness against `qwen2.5:7b-instruct` via local Ollama (version 0.9.0) on CPU-only hardware. Full results and analysis in `backend/experiments/ai_evaluation/README.md`.

### Major engineering decisions
- Chose `qwen2.5:7b-instruct` as the single model to spike on, per Feature 013's recommendation (stronger math-reasoning benchmarks at this size than general-purpose peers) — no multi-model comparison was attempted in this feature, by design.
- Ground-truth labels (`expectedLabel` in `dataset.json`) were deliberately set as a human judgment of actual correctness, not as "does it exact-match `answer_keys.json`" — several samples exist specifically because they diverge (e.g. "Trapezoid" vs. the stored "Trapezium"; "4/8" left unsimplified for a question that asks to simplify). This makes the dataset a meaningful test of whether AI evaluation improves on rule-based matching, not just a restatement of it.
- Used `httpx` (already a dependency, used elsewhere for `TestClient`) for the Ollama HTTP call instead of adding a new HTTP library or an Ollama SDK — kept the client to a single function, no retry/abstraction layer, per the constraint to keep this replaceable and simple rather than build infrastructure for a spike.

### Verification summary
- Production suite unaffected: 29/29 backend pytest still passing, confirmed after the spike's files were added (`git status` shows only new files under `backend/experiments/`, nothing modified under `app/` or `tests/`).
- Harness run: 30/30 samples completed without error. **100% JSON parse success, 100% schema validation success** against the experimental `AIEvaluation` model. **93% correctness agreement (28/30)** with hand-labeled ground truth. Mean latency 39.3s, median 38.7s, min 34.2s, max 57.7s (first call, likely cold-start) — CPU-only inference on a laptop with no dedicated GPU (Intel i3-1215U, 16GB RAM).

### Implementation notes
- Both disagreements were read individually rather than just counted: one (`s22`, "what makes a square different from a rectangle") is arguably a case where the model's stricter reading is more defensible than the ground-truth label used here, not a clear model error. The other (`s26`, objecting to using a ruler to set a compass width) looks like a genuine model overreach — a real finding about the risk of the AI penalizing a valid method.
- Reported confidence clustered at three values (0.85, 0.95, 1.00) across all 30 samples, and both disagreements were reported at 0.95 — statistically indistinguishable from many correct judgments at the same value. This means Feature 013's confidence-gated fallback design, as specified, would not have caught either error in this run. Flagged as a concrete open problem for Feature 015 rather than something this spike could resolve with only 30 samples.
- Misconception tags came back as free-form strings with inconsistent formatting even within this one run (`incorrect_solution` vs. `incorrect solution`, `incorrect_addition_of_fractions`, `confusion_with_symbol`, etc.) — confirms Feature 013's design note that a controlled vocabulary must be enforced by the system, not left to emerge from the model.

## 2026-07-22

### Features completed
- Implemented the FastAPI backend foundation (health check, API versioning, CORS, config, logging).
- Introduced a `questionService` frontend service layer so components no longer access question/chapter data directly.
- Connected the frontend to the backend: implemented `GET /api/v1/chapters`, `GET /api/v1/chapters/{chapterId}`, `GET /api/v1/chapters/{chapterId}/questions`, and `GET /api/v1/chapters/{chapterId}/questions/{questionId}`, and rewired `questionService` to call them over HTTP instead of reading local static data.
- Implemented the first version of the Answer Evaluation API: `POST /api/v1/questions/{questionId}/answer`, rule-based (exact match, trimmed) with attempt-based coaching messages and UI state, establishing the contract future AI-based evaluation will fill in.
- Wired the Feature 010 coaching contract into `QuestionPage` (Feature 011): a correct answer (`coach.nextAction === 'NEXT_QUESTION'`) now shows an explicit "Next Question" button instead of requiring hints/solution to be revealed first, and a second wrong attempt (`SHOW_HINT`) adds a visual nudge to the existing hint button. No backend or API changes.
- Separated evaluation from coaching inside the backend (Feature 012), an internal refactor preceded by an architecture review. `answer_service.evaluate_answer` was split into three collaborators: `evaluation_service.evaluate(question, submission) -> Evaluation` (the exact-match correctness check), `coaching_service.decide(is_correct, attempt_number) -> (Coach, UiState)` (the attempt-based coaching derivation), and `answer_service.evaluate_answer` itself, now a thin orchestrator that resolves the `Question`, calls both, and assembles the existing `AnswerEvaluationResponse`. No route, schema, or frontend changes.

### Major engineering decisions
- Chapter and question data now lives once, as JSON under `backend/app/data/`, and is the single source of truth for both the API and the frontend (reached via HTTP). The frontend's former `src/data/chapters.ts` and `questions.ts` were removed as dead code once the service switched to fetching from the backend.
- `questionService` methods became async (`Promise`-returning) to support real HTTP calls. This required updating `ChapterSelectionPage`, `ChapterPage`, and `QuestionPage` to load data via `useEffect`/`useState` instead of calling the service synchronously during render — a deliberate, minimal exception to "don't change components," confirmed with the user before implementing, since a purely synchronous service could not wrap real network calls.
- Added a single frontend API configuration point (`src/config/api.ts`, backed by the `VITE_API_BASE_URL` env var) so the backend URL is never hard-coded in the service.
- The `Question` domain model has no field for a comparable short answer (only a full-sentence `solution`), so a private `backend/app/data/answer_keys.json` (questionId → expected answer) was added, read only by `answer_service.py`. It is deliberately kept out of the `Question`/`QuestionRecord` schema tree so the existing chapter/question GET endpoints can never leak it. Canonical answers for the handful of free-text questions (e.g. quadrilateral properties) were derived by judgment from the existing `solution` text; exact-string matching is a known Phase-1 limitation for those questions.
- Feature 011's scope was deliberately narrowed via clarifying questions before implementation, rather than wiring the full `ui` state contract literally: hint reveal stays fully self-service (a suggestion nudge, not a hard gate tied to `ui.hintLevel`), solution reveal is untouched (still gated by all hints revealed, not by `ui.canRevealSolution`), and answer submission stays always-enabled (no new disabling logic tied to `ui.canTryAgain`). Only the correct-answer path changes behavior — this keeps the change low-risk and reversible while still closing the gap Feature 010 deliberately deferred.
- Feature 012's scope was deliberately kept to a plain two-function split rather than a general-purpose plugin framework, per the preceding architecture review: no strategy interface, registry, factory, or config-driven selection was introduced, since exactly one evaluation strategy exists today and building selection infrastructure for a second one that doesn't exist yet would be speculative. `evaluation_service.evaluate` takes the full `Question` object (not just `question_id`) as a deliberate, low-cost hedge — a future free-form-answer evaluator will almost certainly need `question.question`/`hints`/`solution` as grounding context, and widening a narrower signature later would be a second breaking change to the internal contract. `answer_service.py` now imports `question_service` directly (previously only the route did) to resolve the `Question` before evaluating; no circular import risk since `question_service` has no service-layer dependencies of its own.

### Verification summary
- Backend: `pytest` (9 tests, later 16 with answer evaluation) and a live `uvicorn` smoke test of all endpoints, including 404 cases.
- Frontend: `tsc -b && vite build`, `oxlint`, and `vitest` (16 tests, later 18 with `submitAnswer`) all pass.
- Full manual browser walkthrough with both servers running: chapter list, chapter detail, question navigation, hints, solution reveal, 404 handling for an unknown chapter, and the full answer-evaluation flow (correct answer, and incorrect attempts 1/2/3 producing the correct coaching message each time) — all verified against the real backend with no console errors, and hint/solution reveal confirmed unaffected.
- Feature 011: backend untouched, still 20/20 pytest. Frontend `tsc -b && vite build`, `oxlint`, and `vitest` (18/18, no new tests needed — no new component boundaries introduced) all pass. Live browser walkthrough: first wrong attempt shows no nudge, second wrong attempt applies the `hint-button-suggested` class (confirmed via DOM inspection), correct answer shows "Next Question" and advances to the next question with a clean state reset, and the manual hint-through-to-solution path was regression-checked and confirmed unchanged.
- Feature 012: 29/29 pytest passing — the original 20 (including all 11 of `test_answers.py`, unmodified) plus 9 new focused unit tests (`test_evaluation_service.py`: correct, incorrect, whitespace-trimmed, empty; `test_coaching_service.py`: correct → `NEXT_QUESTION`, attempts 1/2/3+ → `TRY_AGAIN`/`SHOW_HINT`/`SHOW_SOLUTION`). `test_answers.py` passing unmodified is the regression proof that the refactor is behavior-preserving. Also live-smoke-tested the running endpoint on a scratch port (correct answer, second wrong attempt, unknown-question 404) and confirmed byte-identical response JSON to pre-refactor behavior.

### Implementation notes
- Kept the async page-loading additions minimal (a `cancelled` flag per effect to avoid setting state after unmount/param change); no new loading UI or styling was introduced, so a brief transient "not found" state can flash during the network round trip before data arrives.
- `QuestionPage` now tracks `attemptNumber` and calls `submitAnswer` on the existing "Check Answer" button; only `coach.message` was surfaced, in the same paragraph slot that previously showed a static "will be available after backend integration" placeholder. `evaluation.isCorrect/score`, `coach.nextAction`, and all of `ui` are captured in state but not yet wired to any UI behavior (no auto-advance, no gated hint/solution reveal) — reserved for a future feature rather than forcing new UI work into this one.
- Feature 011 reads `evaluation.coach.nextAction` directly (`isCorrectAnswer`, `isHintSuggested` derived values in `QuestionPage`) rather than introducing new component state; the existing "Chapter Complete" / "Mark Question Complete" block was merged with the new correct-answer path (`questionEnded = isCorrectAnswer || showSolution`) instead of duplicating that markup for a separate "Next Question" branch.
- Feature 012 kept `answer_keys.json` private to `evaluation_service.py` only (moved, not duplicated) — no other module reads it, so the "never expose expected answers" guarantee from Feature 010 is unchanged. `app/api/routes/answers.py` and `app/schemas/answer.py` were not touched at all; the route still calls `answer_service.evaluate_answer(question_id, body.submission)` with the exact same signature it always has.

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
