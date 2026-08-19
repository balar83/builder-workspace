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

### Milestone C2 — Learning Session Engine (Stateful Runtime)
The stateful half: `session_store.py` (SQLite persistence, `sessions` table, `attempts.db` renamed to `runtime.db`), `session_builder.py` (one-time session creation), `content_repository.get_question_content()` (the second, serving-time content path), `runtime_session_manager.py` (`get_current_question`/`submit_answer`, lazy `expired`/`abandoned` lifecycle transitions, server-derived attempt numbers), and four new API routes (`POST /sessions`, `GET /sessions/{id}/current-question`, `POST /sessions/{id}/answer`, `GET /sessions/{id}`). Question 1 and question 10 are served by the exact same code path; the complete question bank is never returned to the client. Two implementation-discovered decisions worth knowing before touching this code: `submit_answer` advances on `SHOW_SOLUTION` as well as `NEXT_QUESTION` (no separate "acknowledge" endpoint exists); the degradation-policy refinement accepted in design review was deliberately not implemented (out of this milestone's explicit scope). Full detail in `Development-Journal.md`'s 2026-07-28 (Milestone C2) entry. No new ADR yet — ADR-006/007 are scoped and ready to write now that both C1 and C2 are implemented, tested, and verified.

### Milestone C1 — Learning Session Engine (Stateless Planning Layer)
Six new backend service modules implementing the design-reviewed Learning Session Engine's stateless half: `learning_context_service`, `session_planner`, `constraint_resolver`, `content_repository`, `question_selector`, and a thin composing `session_planning_pipeline`. Deterministic throughout — seeded selection, rule-based difficulty degradation, no ML. No API routes, no session persistence — that was Milestone C2, now also complete (see above). Two implementation decisions flagged as materially affecting C2 (uniform tier-backfill behavior, `questionTypes` as a documented no-op pending P2). Full detail in `Development-Journal.md`'s 2026-07-28 (Milestone C1) entry.

### Milestone B — Server-Side Attempt History
SQLite-backed attempt log (`app/services/attempt_service.py`) and a session-gated `GET /performance/me` returning deterministic per-topic accuracy/streak/mastery — resolves the persistence question ADR-004 deferred (see [ADR-005](ADR/ADR-005-server-side-attempt-history.md)). Recording is conditional on a student session existing; anonymous use is unaffected. Scoped to logging + aggregates only — session orchestration for the Assessment Engine is separate, future work. This is what makes Milestone A's identity layer non-dormant. Full detail in `Development-Journal.md`'s 2026-07-28 (Milestone B) entry, including a background-task ordering bug found and fixed during live verification.

### Features 018–021 — Content Pipeline & Topic Delivery (Release 0.2, first slice)
Built the tooling `LearningExperienceArchitecture.md`'s Topic model needed to become real: a `Topic` data model and retrieval API plus `TopicPage` (Feature 018); a seeded, validated procedural question generator, "Template Engine v1" (Feature 019); a 5-stage content-authoring trail per chapter with an approval-status gate (Feature 020); and a 7-phase Stage 10 Export Pipeline that safely, atomically merges approved canonical content into runtime data, validated against the real backend Pydantic schemas (Feature 021). Used end-to-end to migrate Linear Equations live: 5 → 44 questions, 1 Topic. Data Handling is authored through stage 6 (42 questions) but not yet exported at the time this entry was written — since exported, see Release 0.1.1 below.

### Release 0.1.1 — Curriculum Expansion (2026-08-07)
Data Handling (5 → 42 questions, 1 new Topic) and Understanding Quadrilaterals (5 → 40 questions, 1 new Topic, authored from scratch after the official NCERT PDF proved scanned/non-extractable) both exported via the existing Stage 10 pipeline, no engineering changes. Folded into the Release 0.1.2 commit. Full detail in `Development-Journal.md`'s 2026-08-07 entry.

### Release 0.1.2 — UX overhaul, production-readiness audit, deployment fixes (2026-08-07)
Frontend design-token system, rebuilt Learn page, reworked question experience, consistent `BackLink` navigation, verified at 10 responsive breakpoints. An adversarial production-readiness audit found and fixed 11 defects; two more (Vercel SPA-fallback gap, session hint/reveal-solution dead-end) were found and fixed post-deploy via hands-on production testing. Full detail: `Release-0.1.2-Final.md`, `Phase-1-Handoff.md`.

### Curriculum Expansion Milestone (2026-08-15, commit `fbc7eed`)
New chapter A Square and A Cube (40 questions, full Topic/Learn content). Rational Numbers expanded 5→40 (Topic replaced with a 5-section explanation); Practical Geometry expanded 5→35 (deliberately still no Topic, via a new topic-less export path, `run-topicless.js`). 12 backend test files updated for Rational Numbers' content-shape change. 205/205 backend, 112/112 frontend, both unaffected in count. See `Phase-1-Handoff.md` §8/§12.6/§17.

### Slice A1 — Structured Learning Content Foundation (2026-08-17, commit `6285263`)
Additive `Topic.concepts`/`.workedExamples` (structured `Concept`/`LearningObjective`/`WorkedExample`) and `Question.objectiveIds`, alongside unchanged legacy fields. Stage 10 gained a legacy-vs-structured migration-state discriminator so every chapter stays re-exportable through the migration window. A Square and A Cube migrated as the sole pilot chapter; the other 4 Topic-bearing chapters are unaffected — that's Slice A2, not started. Zero frontend/evaluation/coaching/Learning Session Engine changes. Full record: `Structured-Learning-Content-Design-Proposal.md` §W.

### M2.1–M2.3 — Question Response Semantics Foundation, Single Choice, Multi Choice (2026-08-17, commits `e41670a`/`87e8414`/`e120a1d`)
Built the schema→evaluator→pipeline→UI chain for question-type diversity: `questionType`/`responseSpecification` added additively to `Question` (default `short_text`, all existing questions unaffected); an `Evaluator` protocol + registry dispatch in `evaluation_service.py` replacing what had been one hardcoded exact-match check; three new evaluators (`numeric_tolerance_v1`, `single_choice_v1`, `multi_choice_v1`) alongside the extracted, behavior-preserving `short_text_v1`; Stage 10 structural validation for `questionType`; a frontend `QuestionResponseInput` dispatch component with `SingleChoiceInput`/`MultiChoiceInput`. Deliberately a capability slice, not an activation slice — no production content used any of the new types yet at the close of M2.3. Full design record: `Question-Response-Semantics-Design-Proposal.md` (Parts I and II). Architectural decision recorded in [ADR-008](ADR/ADR-008-question-response-evaluation-architecture.md).

### M2.4 — Content Activation Pilot: Linear Equations (2026-08-17, commit `2e0205d`)
Activated the M2.1–M2.3 evaluators against real content for the first time: Linear Equations converted to 3 `single_choice`, 2 `multi_choice`, 28 `numeric`, 11 remaining `short_text` (44 questions unchanged, 14/16/14 difficulty split unchanged). Content-only change — no evaluator, schema, coaching, session-engine, or frontend source file touched. The `numeric` pilot landed in Linear Equations rather than the originally-proposed Squares and Cubes (`Question-Response-Semantics-Design-Proposal.md` §26/§27) because Linear Equations is where the documented answer-matching brittleness actually lives — see that document's reconciliation note and `Development-Journal.md`'s 2026-08-17 (M2.4) entry. 267/267 backend, 88/88 Stage 10 pipeline, 134/134 frontend.

### Content import — Squares and Cubes test questions (2026-08-19, commit `a071335`)
Squares and Cubes expanded 40 → 52 questions via the existing Stage 10 pipeline. Content-only. See `Development-Journal.md`'s 2026-08-19 entry.

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

## Recommended Next: Documentation & Architecture Reconciliation, then A2

As of M2.4 (commit `2e0205d`) and the Squares & Cubes content import (commit `a071335`), production is verified at: 267/267 backend, 134/134 frontend, 88/88 Stage 10 pipeline; Linear Equations at 3 single_choice/2 multi_choice/28 numeric/11 short_text; Squares & Cubes at 52 questions. The agreed forward sequence:

1. **Documentation & Architecture Reconciliation** — reconcile `Backlog.md`/`Roadmap.md`/`PROJECT_STATUS.md`/`Development-Journal.md`/`Phase-1-Handoff.md`/`Release-Notes.md` against the verified state above and write [ADR-008](ADR/ADR-008-question-response-evaluation-architecture.md) for the evaluator-registry architecture. This item.
2. **Slice A2 — TopicPage structured-content cutover.** `TopicPage.tsx`/`types/topic.ts` consume `topic.concepts` instead of the legacy joined string, for the one already-migrated pilot chapter (A Square and A Cube, Slice A1).
3. **A2b — migrate remaining 4 Topic-bearing chapters** (Linear Equations, Data Handling, Understanding Quadrilaterals, Rational Numbers) onto the structured `Topic.concepts` shape.
4. **Attempt telemetry enrichment** — populate the already-existing-but-unused `attempts.hints_used`/`.time_taken_seconds`/`.question_type` columns (`Question-Response-Semantics-Design-Proposal.md` Part II §O.5).
5. **Product fork decision + small deferred fixes** — `Phase-1-Handoff.md` §13's remaining items (name-length limits, "list my classes" endpoint).
6. **Either deterministic misconception coaching or teacher/classroom adoption** — a Product Architect decision between the two paths, not both.
7. **Later: M3 `multi_part`** — the evaluator for `le-q25`/`le-q37`/`le-q40`-style compound-answer questions (`Question-Response-Semantics-Design-Proposal.md` §M item 3).

None of items 2–7 are authorized to start until their own design/review/approval pass, per this project's established workflow. Shadow Mode continues accumulating real evaluations unchanged since Feature 015, independent of this sequence.
