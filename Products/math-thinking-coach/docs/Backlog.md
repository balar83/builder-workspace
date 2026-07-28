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

### Feature 015 — Shadow Mode AI Evaluation
Promotes the minimum of Feature 014's spike code into production-callable modules (`app/services/ai_evaluation_{client,prompt,service}.py`, `app/schemas/ai_evaluation.py`), adding timeout handling and error classification the spike didn't need. A new out-of-band orchestrator (`app/services/shadow_evaluation_service.py`) runs the AI evaluator alongside the rule-based one on every real answer submission, dispatched via FastAPI `BackgroundTasks` after the existing response is built — never blocking or altering it — and logs one JSONL record per evaluation via `app/services/shadow_log_writer.py`. Guarded end-to-end by `settings.shadow_mode_enabled` (default on, disableable without a deploy). `evaluation_service.evaluate()` was refactored to source the canonical expected answer through a new `get_expected_answer()` accessor, so both rule-based and AI evaluation read `answer_keys.json` through exactly one path. Zero API, coaching, or frontend changes — verified by the full pre-existing `test_answers.py` suite passing unmodified plus new adversarial tests forcing the shadow path to fail or be disabled. 60/60 backend tests passing (47 → 60). Full detail in [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md) and `Development-Journal.md`'s 2026-07-23 entry.

### Release 0.1 — "It Remembers You" (Feature 016 + Feature 017)
Client-side progress persistence, entirely frontend: a `progressService`/`progressStore` layer (localStorage-backed, schema-versioned) that `QuestionPage` reads and writes at its existing state transitions to resume a chapter at the saved question. The previously dead `/chapter/:chapterId` route is repurposed into a real Chapter Overview (title, description, completed-count, a "Start Learning"/"Continue Learning" CTA into the unchanged question flow); `ChapterCard` routes through it and shows a completed-count badge; `HomePage`'s previously non-functional "Continue Learning" button now navigates to the last-active chapter, falling back to Chapter Selection when nothing's been recorded yet. Zero backend changes — ADR-001 and ADR-002 both unaffected. Full detail in `Development-Journal.md`'s 2026-07-27 entries.

### Milestone A — Student/Teacher Identity
Minimal auth, the first slice of the "scalable assessment system" milestone: teacher accounts (email/password) that can create a class and get a join code; student identity via that code + a display name + a short PIN, deliberately no student email/password (see [ADR-004](ADR/ADR-004-student-teacher-identity.md)). Ships dormant — login/join work end-to-end but nothing yet consumes identity; the existing anonymous coaching flow is untouched and independently reverified. Full detail in `Development-Journal.md`'s 2026-07-28 entry.

### Milestone C1 — Learning Session Engine (Stateless Planning Layer)
Six new backend service modules implementing the design-reviewed Learning Session Engine's stateless half: `learning_context_service`, `session_planner`, `constraint_resolver`, `content_repository`, `question_selector`, and a thin composing `session_planning_pipeline`. Deterministic throughout — seeded selection, rule-based difficulty degradation, no ML. No API routes, no session persistence — that's Milestone C2. Two implementation decisions flagged as materially affecting C2 (uniform tier-backfill behavior, `questionTypes` as a documented no-op pending P2). Full detail in `Development-Journal.md`'s 2026-07-28 (Milestone C1) entry. No new ADR — one is scoped (ADR-006/007) but deferred until C2 also ships, per this project's convention that ADRs record shipped decisions.

### Milestone B — Server-Side Attempt History
SQLite-backed attempt log (`app/services/attempt_service.py`) and a session-gated `GET /performance/me` returning deterministic per-topic accuracy/streak/mastery — resolves the persistence question ADR-004 deferred (see [ADR-005](ADR/ADR-005-server-side-attempt-history.md)). Recording is conditional on a student session existing; anonymous use is unaffected. Scoped to logging + aggregates only — session orchestration for the Assessment Engine is separate, future work. This is what makes Milestone A's identity layer non-dormant. Full detail in `Development-Journal.md`'s 2026-07-28 (Milestone B) entry, including a background-task ordering bug found and fixed during live verification.

### Features 018–021 — Content Pipeline & Topic Delivery (Release 0.2, first slice)
Built the tooling `LearningExperienceArchitecture.md`'s Topic model needed to become real: a `Topic` data model and retrieval API plus `TopicPage` (Feature 018); a seeded, validated procedural question generator, "Template Engine v1" (Feature 019); a 5-stage content-authoring trail per chapter with an approval-status gate (Feature 020); and a 7-phase Stage 10 Export Pipeline that safely, atomically merges approved canonical content into runtime data, validated against the real backend Pydantic schemas (Feature 021). Used end-to-end to migrate Linear Equations live: 5 → 44 questions, 1 Topic. Data Handling is authored through stage 6 (42 questions) but not yet exported — see "Recommended Next" below. Full detail in `Development-Journal.md`'s 2026-07-27 entries and [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md).

*Note: this numbering reflects what was actually built. An earlier draft of this backlog had different titles under 008/009 — this file is the corrected, authoritative history.*

---

## Ready

None currently scoped and approved. See "Recommended Next" below — once a candidate is approved for scoping, it moves here.

*Note on item typing: this backlog doesn't split into separate Engineering/Product sections. Every item shipped so far (007–014) is product-feature-shaped — there's no standing engineering-only queue (tech debt, infra) yet to justify the split. If/when a pure-engineering item appears (e.g. a dependency upgrade with no user-facing effect), tag it inline (`Type: Engineering`) rather than forking this file.*

---

## Backlog scope note

Per `AI-Builder-OS/DOCUMENTATION_STANDARDS.md`, this file tracks **approved future work only**. It previously carried a "Future (unscoped / unprioritized)" section that, by definition, didn't belong here — none of those items were approved. As of the 2026-07-23 Product Foundation Sprint, that content has moved:

- Thematic, sequenceable items (personalized hints, misconception-informed coaching, adaptive hint engine, student progress history, statistics dashboard, teacher portal, OCR, voice) → [`Roadmap.md`](Roadmap.md), medium/long-term sections.
- Confidence-gated live AI evaluation → `Roadmap.md`, medium-term (still blocked on the Feature 014 calibration gap).
- Anything genuinely undecided → [`Idea-Inbox.md`](Idea-Inbox.md).

---

## Recommended Next: Milestone C2 (stateful session runtime), P1's UX fixes, export Data Handling, operate Shadow Mode

Milestones A (identity), B (server-side attempt history), and C1 (stateless planning layer) are implemented and committed (2026-07-28). Per the "scalable assessment system" sequencing in `Roadmap.md`, several things can proceed, none blocking the others:

- **Milestone C2 (stateful session runtime)** — Session Builder, Runtime Session Manager, session persistence (technology still open — SQLite recommended, matching ADR-005's reasoning), and the one-question-at-a-time API surface. Needs its own implementation-ready design review before code, same as B and C1 both got. Once shipped, ADR-006 (planning/selection, covering C1) and ADR-007 (runtime/persistence, covering C2) should both be written, per the scope already agreed during design review.
- **P1's Question-page UX fixes** — independent of the data-model work, addresses the concrete, measured crowding problem (44-item progress-dot grid) directly.
- **Shadow Mode** (unchanged since Feature 015): let it run and accumulate real evaluations in `shadow_eval_log.jsonl` past Feature 014's 30-sample baseline. Once a meaningful sample exists, review it the way Feature 014's two disagreements were reviewed individually (not just an aggregate agreement percentage), and answer the specific questions Feature 014 left open — does confidence actually separate trustworthy from untrustworthy judgments at scale, and what does the real misconception-tag vocabulary look like. That review is what scopes confidence-gated live evaluation (not yet numbered as a Feature — see the note above on Release/Feature numbering); confidence thresholds are part of that future decision, not something to pre-commit before the data exists.
- **Export Data Handling**: 42 questions are authored and coverage-reviewed (`stage6-expansion-coverage-report.md`) but sitting at `reviewStatus: "ai-generated"`, one Stage 10 export run away from live once reviewed and approved — the nearest, lowest-effort next content win.
