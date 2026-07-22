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

### Feature 012 — Separate Evaluation and Coaching Responsibilities
Internal backend refactor, no API or frontend changes. Split `answer_service.evaluate_answer` into three collaborators: `evaluation_service.evaluate(question, submission)` (the exact-match correctness check, moved unchanged, now the seam a future AI evaluator can replace without touching coaching logic), `coaching_service.decide(is_correct, attempt_number)` (the attempt-based `NextAction`/`Coach`/`UiState` derivation, moved unchanged), and `answer_service.evaluate_answer` itself, now a thin orchestrator. `POST /api/v1/questions/{questionId}/answer`'s request/response contract is byte-for-byte unchanged, verified by the pre-existing `test_answers.py` suite passing with no assertion changes plus a live smoke test.

### Feature 014 — Local AI Evaluation Spike (experimental, not production)
Isolated playground at `backend/experiments/ai_evaluation/` — not imported by `app/*`, no route/schema/frontend changes. A standalone harness called local Ollama (`qwen2.5:7b-instruct`) against a 30-sample hand-labeled dataset covering correct answers, arithmetic mistakes, conceptual mistakes, incomplete reasoning, and free-form explanations. Results: 100% valid JSON, 100% schema-valid against an experimental structured-output model, 93% agreement (28/30) with ground truth, mean latency 39.3s on CPU-only hardware. Two key findings beyond raw accuracy: reported confidence did not distinguish the two disagreements from correct judgments (undermines the Feature 013 confidence-gated-fallback design as currently specified), and misconception tags came back as free-form, inconsistently-formatted strings (confirms Feature 013's call for a controlled vocabulary is required, not optional). Full detail in `backend/experiments/ai_evaluation/README.md`.

*Note: this numbering reflects what was actually built. An earlier draft of this backlog had different titles under 008/009 — this file is the corrected, authoritative history.*

---

## Ready

None currently scoped. See "Recommended Next" below.

---

## Future (unscoped / unprioritized)

- Shadow Mode AI evaluation (Feature 015) — run the AI evaluator from Feature 014 alongside the rule-based one on real traffic, log/compare, change no live behavior yet.
- Confidence-gated live AI evaluation — needs the confidence-calibration gap found in Feature 014 addressed first.
- Personalized hint generation
- Misconception-informed coaching content
- Adaptive Hint Engine
- Student Progress History
- Statistics Dashboard
- Teacher Portal
- OCR Question Scanner (Phase 2, per ProductArchitecture.md)
- Voice Input / Voice Explanation (Phase 2)

---

## Recommended Next: Feature 015 — Shadow Mode AI Evaluation (unscoped)

Feature 014's spike showed `qwen2.5:7b-instruct` is directionally promising (93% agreement, 100% valid structured output) but surfaced two problems worth investigating with more data before any live behavior change: reported confidence didn't separate correct from incorrect judgments in this run, and misconception tags need an enforced controlled vocabulary. Feature 015 would implement the real AI evaluator behind the seam Feature 012 built, run it alongside the rule-based evaluator on real traffic, and log/compare — without ever returning the AI result to coaching. Zero behavior change, all risk contained to logging; the safe way to gather the larger sample needed to resolve the confidence-calibration question before a confidence-gated live feature is attempted. Not yet scoped: where comparison data is stored (the product has no persistence today), and exact confidence thresholds — both need product-direction input.
