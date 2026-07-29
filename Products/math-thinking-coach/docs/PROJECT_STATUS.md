# Current Milestone

This file tracks two separate tracks that move at different speeds — don't conflate them.

## Engineering Milestone

Milestone 2 – Coaching Engine, extended by Release 0.2's first slice (Content Pipeline & Topic Delivery), now joined by Milestones A, B, C1, and C2 of the Scalable Assessment System (Student/Teacher Identity, Server-Side Attempt History, Learning Session Engine — stateless planning layer and stateful runtime, both complete, now documented as [ADR-006](ADR/ADR-006-learning-session-planning-architecture.md)/[ADR-007](ADR/ADR-007-learning-session-runtime-architecture.md)). **Milestone F1 (Student Learning Experience / Session Frontend) is now in progress — Slice 1 of 8 (Student Authentication & Dashboard Foundation) complete 2026-07-29**, per `Session-Frontend-Implementation-Plan.md`. Slices 2–8 are not started; do not begin Slice 2 without architectural review, per this milestone's own instruction.

## Documentation Milestone

Product Foundation Sprint (2026-07-23) — matured `Product-Vision.md`, `ProductArchitecture.md`, `Backlog.md`; added `Roadmap.md`, `Idea-Inbox.md`, and the project's first real ADR (ADR-001). No code changed. See `Development-Journal.md` if this sprint later needs its own entry, and the Product Foundation Sprint Report for the full summary.

Release 0.1 documentation closeout (2026-07-27) — added `docs/LearningExperienceArchitecture.md` (previously chat-only, now a permanent document) and the Release 0.1 entries across `Development-Journal.md`, `Release-Notes.md`, `Roadmap.md`, `Backlog.md`, `ProductArchitecture.md` (new §6), `Wireframes.md`, and this file.

Content Pipeline reconciliation (2026-07-28) — Features 018–021 (Topic data model/API, Template Engine v1, content authoring pipeline, Stage 10 Export Pipeline) had been implemented and verified on 2026-07-27 but left undocumented and uncommitted. Backfilled: [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md), `Development-Journal.md`, `Backlog.md`, `Roadmap.md`, `ProductArchitecture.md` §7/§8, `LearningExperienceArchitecture.md` §7, `HANDOFF_PROMPT.md`, and this file — all now match the actual repository state, verified by reading the code and running the test suites, not by asserting design intent.

Scalable Assessment System design review + Milestone A (2026-07-28) — before any code, reviewed the requested "Assessment Engine/teacher-ready assessments" milestone against `Product-Vision.md`'s Coaching vs. Assessment Philosophy (resolved: teacher-facing surface, student experience unchanged) and identified auth as an unstated prerequisite, sequenced as its own Milestone A. Implemented, tested, and live-verified same day; documented in [ADR-004](ADR/ADR-004-student-teacher-identity.md) and `Development-Journal.md`'s 2026-07-28 entry.

Scalable Assessment System P1–P4 design review + Milestone B (2026-07-28) — a follow-up design pass covering Chapter/Question UX (P1), the Assessment Engine (P2), the Question Selection Engine (P3), and a deterministic Student Performance Model (P4). Surfaced and resolved a real conflict between P2's student-configurable "Test mode" and `Product-Vision.md`'s Coaching vs. Assessment Philosophy (resolved via an explicit addendum to that document — Test mode is opt-in and self-feedback-framed, default coaching stays score-free). Identified Milestone B as the actual next-buildable piece and implemented it same day: SQLite-backed attempt history, live-verified, with a real background-task ordering bug (attempt recording queuing behind Shadow Mode's slow AI call) caught and fixed during that verification. See [ADR-005](ADR/ADR-005-server-side-attempt-history.md) and `Development-Journal.md`'s 2026-07-28 (Milestone B) entry.

Learning Session Engine design review (3 iterations) + Milestone C1 (2026-07-28) — P3's Question Selection Engine was elevated, after review, to a full Learning Session Engine architecture (blueprint → refinement review → final domain-model validation), then split into a stateless planning layer (C1) and a stateful runtime layer (C2) along the one property that actually mattered: which half needs a persistence decision. C1 implemented same day, faithfully against the validated design — six deterministic service modules, 151/151 backend tests passing, two implementation decisions documented as materially affecting C2. No new ADR yet, per this project's convention that ADRs record shipped decisions, not designs. See `Development-Journal.md`'s 2026-07-28 (Milestone C1) entry.

Learning Session Engine runtime design review (blueprint → critical review → final consolidation) + Milestone C2 (2026-07-28) — the stateful half of the Learning Session Engine: `session_store.py` (SQLite persistence, `attempts.db` renamed to `runtime.db` in the same change), Session Builder, a two-tier Content Repository extension (`get_question_content`), Runtime Session Manager (`get_current_question`/`submit_answer`, lazy `expired`/`abandoned` lifecycle transitions, server-derived attempt numbers, position-guard concurrency control), and four new `/api/v1/sessions` routes. Implemented same day in the 6-step order specified by the task (persistence → builder → content repository → runtime manager → API → tests), each step compiling and passing the full suite before the next began. 198/198 backend tests passing; all four new test files (`test_session_store.py`, `test_session_builder.py`, `test_runtime_session_manager.py` — 24 tests, `test_sessions_api.py` — 11 tests) passed on their first run, evidence the design reviews caught the real issues before code. Live-verified via a full curl walkthrough against a running server. No new ADR yet, deliberately — ADR-006 (C1) and ADR-007 (C2) are both scoped and now writable but were explicitly deferred until requested. See `Development-Journal.md`'s 2026-07-28 (Milestone C2) entry.

Release readiness, ADR finalization, and Session Frontend planning (2026-07-29) — three sequential planning passes, no code: **RR1** produced `Release-Plan-v1.0.md` (scope, acceptance criteria, Git strategy, UX-gap classification, a grounded recommendation to defer Data Handling's 42-question export since it's still gated at `reviewStatus: "ai-generated"`, and a recommendation against building `GET /sessions/active` for v1.0). **RR2** produced [ADR-006](ADR/ADR-006-learning-session-planning-architecture.md) and [ADR-007](ADR/ADR-007-learning-session-runtime-architecture.md), finalizing the Learning Session Engine's architectural record. **Milestone F0** produced `Session-Frontend-Implementation-Plan.md` — a full frontend inventory, component hierarchy, 8-slice implementation order, state-ownership mapping against ADR-007, and a routing/testing/risk review, all grounded in the actual shipped frontend code. See `Release-Plan-v1.0.md`, `Session-Frontend-Implementation-Plan.md`, and the two new ADRs directly.

Milestone F1, Slice 1 — Student Authentication & Dashboard Foundation (2026-07-29) — first implementation slice of the Session Frontend: `RequireStudent` route guard, `DashboardPage`, `performanceService`/`ChapterPerformanceCard`, and `StudentJoinPage`'s post-login destination changed to `/dashboard`. 59/59 frontend tests passing, 198/198 backend unaffected, live-verified including the topic-correlation logic against real recorded attempt data. See `Implementation-Journal.md` and `Development-Journal.md`'s 2026-07-29 entry.

## Engineering Health

198/198 backend tests passing (65 → 79 with Milestone A's `test_auth.py`, 79 → 94 with Milestone B's attempt-history tests, 94 → 151 with Milestone C1's six new planning modules, 151 → 198 with Milestone C2's persistence/builder/runtime-manager/API test files; unaffected since — Milestone F1's Slice 1 is frontend-only), 59/59 frontend tests passing (49 → 59 with Milestone F1 Slice 1's `performanceService`/`RequireStudent`/`ChapterPerformanceCard` tests — the first frontend work since Release 0.1). Seven architecture decisions on record are implemented, not just designed — [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md) (evaluation/coaching separation), [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md) (Shadow Mode execution and logging), [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md) (content authoring and export pipeline), [ADR-004](ADR/ADR-004-student-teacher-identity.md) (student/teacher identity), [ADR-005](ADR/ADR-005-server-side-attempt-history.md) (server-side attempt history), [ADR-006](ADR/ADR-006-learning-session-planning-architecture.md) (Learning Session planning architecture), and [ADR-007](ADR/ADR-007-learning-session-runtime-architecture.md) (Learning Session runtime architecture) all match the shipped code, verified by diff/by reading the code, not asserted from design intent. Shadow Mode is active: the AI evaluator runs out-of-band on real traffic, and production behavior (the API response, coaching) is unchanged, proven by adversarial tests that force the shadow path to fail or be disabled. Confidence-gated live evaluation (not yet scoped or numbered) isn't blocked by anything technical or architectural — only by operational validation: Shadow Mode hasn't yet accumulated a large enough sample to answer the confidence-calibration and misconception-vocabulary questions Feature 014 left open. No known technical-debt blockers to that path; the known limitations that do exist (the `BackgroundTasks` execution model's ceiling under real concurrent traffic, JSONL's lack of query capability, and an undecided log-retention policy) are already tracked in ADR-002's Trade-offs section and aren't blocking anything today — and Milestone B's own live verification just demonstrated that ceiling concretely (a ~40-90s real Ollama call was blocking a same-request background task queued behind it, fixed by reordering, not by touching ADR-002 itself). The content pipeline (ADR-003) has its own known gap: no automated test suite for the pipeline tooling itself, and a hard runtime coupling to a co-located backend Python venv for schema validation. Milestone A (ADR-004) has its own named gaps: session security (`session_secret_key`, `https_only`) is dev-only pending a real deployment target. Milestone B (ADR-005) is single-file SQLite — fine at classroom scale, not designed for multi-server deployment; no retroactive migration of existing `localStorage` progress into server-side history. Milestone C2 carries its own known gaps, documented rather than silently fixed: no scheduler/cron for session lifecycle — `expired`/`abandoned` transitions are checked lazily on access only; `hintsUsedTotal` is reserved but always 0 (no hint-usage reporting mechanism exists anywhere yet); the accepted-in-design `degradationPolicy`/`substituted` refinement was deliberately not implemented (out of this task's explicit step list, flagged for Milestone E); no frontend consumes any of the four new routes yet.

---

## Completed Features

✓ Frontend MVP

✓ Backend Foundation (Feature 007)

✓ Frontend Service Layer (Feature 008)

✓ Question Retrieval API (Feature 009)

✓ Answer Evaluation API — Rule-Based (Feature 010)

✓ Wire Coaching UI State (Feature 011)

✓ Separate Evaluation and Coaching Responsibilities (Feature 012)

✓ Local AI Evaluation Spike (Feature 014, experimental — see below)

✓ Shadow Mode AI Evaluation (Feature 015 — see below)

✓ Topic Data Model & Retrieval API (Feature 018)

✓ Template Engine v1 (Feature 019)

✓ Content Authoring Pipeline, stages 2–6 (Feature 020)

✓ Stage 10 Export Pipeline (Feature 021)

✓ Student/Teacher Identity (Milestone A, Scalable Assessment System — see below)

✓ Server-Side Attempt History (Milestone B, Scalable Assessment System — see below)

✓ Learning Session Engine — Stateless Planning Layer (Milestone C1, Scalable Assessment System — see below)

✓ Learning Session Engine — Stateful Runtime (Milestone C2, Scalable Assessment System — see below)

◐ Student Learning Experience / Session Frontend (Milestone F1 — in progress, Slice 1 of 8 complete: Student Authentication & Dashboard Foundation, 2026-07-29)

---

## Completed Releases

*Feature-numbered engineering work (007–015) is preserved above; delivery from this point is organized by Release, not Feature — see `Roadmap.md`. Features are still tracked internally within a Release (e.g. Release 0.1 = Feature 016 + Feature 017); Releases describe what students receive, Features describe what engineers build.*

✓ Release 0.1 — "It Remembers You" (Feature 016 — Progress Persistence Layer, Feature 017 — Chapter Overview & Continue Learning)

**Release 0.2 (in progress) — first slice implemented**: Features 018–021 (Content Pipeline & Topic Delivery), Linear Equations migrated end-to-end (44 questions, 1 Topic, live). Not yet complete — Data Handling authored but not exported, and Release 0.2's Understand stage (per `LearningExperienceArchitecture.md`) not yet built.

---

## Current Release

**Release 0.2, first slice implemented 2026-07-27, not yet complete.** Content Pipeline & Topic Delivery (Features 018–021) shipped Linear Equations end-to-end (Learn + Worked Examples stages, per `LearningExperienceArchitecture.md`). Data Handling is authored through stage 6 (42 questions) but not exported — `Release-Plan-v1.0.md` §11 recommends this stay deferred past v1.0, since it's still gated at `reviewStatus: "ai-generated"` and needs human content review, not just an export run. Release 0.1 ("It Remembers You") shipped the same day, a separate non-blocking track. Feature 015 (Shadow Mode) shipped 2026-07-23 and remains operable but hasn't yet accumulated a meaningful sample of real evaluations — see [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md).

**Version 1.0 readiness track (new, 2026-07-29).** `Release-Plan-v1.0.md` defines what Version 1.0 is — the first stable, end-to-end coaching experience for daily student use, not a feature-complete product. Milestone F1 (the Session Frontend) is v1.0's remaining blocker; Slice 1 of its 8-slice implementation plan (`Session-Frontend-Implementation-Plan.md`) is complete.

---

## Next Engineering Objective

**Milestone F1, Slice 2 (Session Configuration) — not started. Do not begin without architectural review first**, per Slice 1's own explicit instruction. Once approved: Slices 2 (`StartPracticePage` form) → 3 (session creation) → 4 (question experience) → 5 (coaching feedback) → 6 (completion) → 7 (resume support) → 8 (final polish), in the dependency order `Session-Frontend-Implementation-Plan.md` §3 lays out. Independent, non-blocking tracks in parallel: P1's Question-page UX fixes (addresses the measured 44-item progress-dot crowding); operate Shadow Mode and gather data (toward scoping confidence-gated live evaluation, not yet numbered). Data Handling's 42-question export stays deliberately deferred — see `Release-Plan-v1.0.md` §11. See `Roadmap.md`'s "Scalable Assessment System" section for the fuller Milestone A–F sequencing, and `docs/ADR/` for the seven accepted ADRs any future engineering builds on.

## Recommended Next Milestone (Documentation)

None queued beyond this reconciliation (2026-07-28). The next documentation milestone should be triggered by the next major engineering milestone (e.g. Release 0.2 fully shipping, or the next major feature's design review), per `AI-Builder-OS/DOCUMENTATION_STANDARDS.md`'s audit cadence, not on a fixed schedule.

---

## Architecture Snapshot

Frontend

React
TypeScript
Vite
Client-side progress persistence (localStorage, via `progressService` — see `ProductArchitecture.md` §6)
Topic pages (Learn + Worked Examples) for chapters with an exported Topic — see `ProductArchitecture.md` §7
Session Frontend, Slice 1 (Milestone F1): `RequireStudent` route guard (this app's first frontend route guard), `/dashboard` with chapter listing and server-side per-topic performance (`performanceService`, first consumer of `GET /performance/me`); Start Practice is a visible, disabled placeholder pending Slice 2

Backend

FastAPI
Topic data model & retrieval API (`GET /chapters/{chapterId}/topics`, `GET /topics/{topicId}`)
Student/teacher identity: session-cookie auth, class join codes (ADR-004)
Server-side attempt history: SQLite-backed, session-gated `GET /performance/me` with per-topic accuracy/streak/mastery (ADR-005) — makes identity non-dormant for logged-in students
Learning Session Engine, stateless planning layer (Milestone C1): six deterministic service modules (context, planner, resolver, repository, selector, pipeline)
Learning Session Engine, stateful runtime (Milestone C2): `session_store.py` (SQLite, `runtime.db`), Session Builder, Content Repository's `get_question_content` extension, Runtime Session Manager (`get_current_question`/`submit_answer`, lazy lifecycle transitions, server-derived attempt numbers) — four routes: `POST /sessions`, `GET /sessions/{id}/current-question`, `POST /sessions/{id}/answer`, `GET /sessions/{id}`; no frontend consumes it yet

Communication

REST API (`/api/v1`)

Current AI

Rule-Based (exact-match, trimmed) — drives coaching and the API response, unchanged since Feature 010.

Shadow AI (logging-only)

Local Ollama (`qwen2.5:7b-instruct`), out-of-band via Feature 015. Never influences coaching or the response; feature-flagged via `SHADOW_MODE_ENABLED` (default on).

Future AI

Confidence-gated live evaluation (not yet scoped or numbered — depends on Shadow Mode data)

Content tooling

Template Engine v1 (seeded procedural question generation) + Stage 10 Export Pipeline (validated, atomic merge into runtime data) — `docs/content-pipeline/`, build-time only, not imported by `app/*` or `frontend/src/*`. See [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md).

---

## Current Branch

main

---

## Uncommitted Work

None. Milestone C2 (and everything before it) was committed at `fd2cf60`. This documentation pass, the two new ADRs, `Release-Plan-v1.0.md`, `Session-Frontend-Implementation-Plan.md`, `Implementation-Journal.md`, and Milestone F1 Slice 1's frontend code (`RequireStudent`, `DashboardPage`, `performanceService`, `ChapterPerformanceCard`, the `StudentJoinPage`/`App.tsx` edits, and their tests) are committed together in the commit immediately following `fd2cf60` — see `git log` for the exact hash.

Run `git status` before starting new work, as always.

---

## Last Verified

Backend ✔ (198/198 pytest — 151 pre-Milestone-C2, 94 pre-Milestone-C1, 79 pre-Milestone-B, 65 pre-Milestone-A, 60 pre-Feature-018, up from 47 pre-Feature-015 — unaffected by Milestone F1 Slice 1, frontend-only)

Frontend ✔ (59/59 vitest — 49 pre-Milestone-F1, +10 for Slice 1's `performanceService`/`RequireStudent`/`ChapterPerformanceCard` tests; `tsc -b`, `oxlint` clean)

Milestone A ✔ (live, 2026-07-28: teacher register → create class → join code; student join with that code → success; student re-login with correct PIN → success; wrong PIN → rejected with no session granted; pre-existing anonymous Home → Select Chapter flow re-verified working identically with and without a session cookie present)

Milestone B ✔ (live, 2026-07-28: student answers a real question → `GET /performance/me` reflects it correctly; anonymous submission confirmed not recorded; a real background-task ordering bug found live — attempt recording was queuing behind Shadow Mode's ~40-90s Ollama call — fixed by reordering, re-verified instant with Shadow Mode both disabled and enabled)

Milestone C1 ✔ (151/151 pytest including 57 new tests against real content — Linear Equations' actual 14/16/14 difficulty split and Rational Numbers' actual 3/2/0 split, not just synthetic fixtures; degradation math hand-verified; no API/persistence surface to live-walkthrough, by design — see `Development-Journal.md`'s 2026-07-28 (Milestone C1) entry for the two implementation decisions flagged as materially affecting C2)

Milestone C2 ✔ (198/198 pytest — 47 new tests across persistence, builder, runtime manager (24), and API (11) layers, all passing on first run; live-verified via curl against a running server with `SHADOW_MODE_ENABLED=false`: created a session over real `rational-numbers` content → served question 1 → submitted a wrong answer → stayed in place and recorded the attempt → submitted the correct answer → advanced → confirmed `GET /performance/me` correctly reflected `questionsAttempted:2, questionsCorrect:1, accuracy:0.5, currentStreak:1` → simulated a stale second-tab resubmission → got 409 with the expected message → queried an unknown session → got 404. Test data files removed after verification. See `Development-Journal.md`'s 2026-07-28 (Milestone C2) entry.

Milestone F1, Slice 1 ✔ (live, 2026-07-29: unauthenticated `/dashboard` visit redirected by `RequireStudent`; real student join through the UI reached a fresh, correctly-empty Dashboard; a real answer submission recorded via the standalone `/answer` endpoint then correctly appeared as a performance badge on exactly the one chapter with both a Topic and an attempt, with every other chapter correctly showing none; mobile viewport confirmed no overflow; no console errors; anonymous flow re-verified unaffected; test data removed afterward. See `Implementation-Journal.md`.)

Content pipeline ✔ (re-verified 2026-07-28: `node docs/content-pipeline/export/run.js --chapter=linear-equations --dry-run` reports 44 questions/1 topic/44 answer keys, zero validation errors, against the current `backend/.venv` Pydantic schemas)

Tests ✔

Build ✔

Feature 014 (spike, not production) verified on its own terms: harness ran all 30 dataset samples against `qwen2.5:7b-instruct` via local Ollama — 100% valid JSON, 100% schema-valid, 93% correctness agreement with hand-labeled ground truth, mean latency 39.3s on CPU-only hardware. See `backend/experiments/ai_evaluation/README.md` for full results and limitations.

Feature 015 (Shadow Mode, production code, zero user-facing effect) verified via 13 new tests: every pre-existing exact-response-body assertion in `test_answers.py` passes unmodified (the regression proof the API contract didn't move), plus adversarial tests forcing the shadow evaluator to fail (`RuntimeError`) and to be disabled (`shadow_mode_enabled=False`), both asserting the response is unaffected. No browser walkthrough applicable — no UI surface changed.

Release 0.1 (Feature 016 + Feature 017, frontend, first genuinely user-visible change since Feature 011) verified via 18 new frontend tests plus live browser walkthroughs with both servers running: an existing-progress profile resuming at the correct chapter/question, a freshly cleared profile falling back correctly to Chapter Selection, a mobile-viewport (375px) check confirming no layout overflow, and backend `pytest` re-run fresh (60/60) to confirm zero backend impact.
