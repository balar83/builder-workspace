# Current Milestone

This file tracks two separate tracks that move at different speeds — don't conflate them.

## Engineering Milestone

Milestone 2 – Coaching Engine, extended by Release 0.2's first slice (Content Pipeline & Topic Delivery), now joined by Milestone A of the Scalable Assessment System (Student/Teacher Identity)

## Documentation Milestone

Product Foundation Sprint (2026-07-23) — matured `Product-Vision.md`, `ProductArchitecture.md`, `Backlog.md`; added `Roadmap.md`, `Idea-Inbox.md`, and the project's first real ADR (ADR-001). No code changed. See `Development-Journal.md` if this sprint later needs its own entry, and the Product Foundation Sprint Report for the full summary.

Release 0.1 documentation closeout (2026-07-27) — added `docs/LearningExperienceArchitecture.md` (previously chat-only, now a permanent document) and the Release 0.1 entries across `Development-Journal.md`, `Release-Notes.md`, `Roadmap.md`, `Backlog.md`, `ProductArchitecture.md` (new §6), `Wireframes.md`, and this file.

Content Pipeline reconciliation (2026-07-28) — Features 018–021 (Topic data model/API, Template Engine v1, content authoring pipeline, Stage 10 Export Pipeline) had been implemented and verified on 2026-07-27 but left undocumented and uncommitted. Backfilled: [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md), `Development-Journal.md`, `Backlog.md`, `Roadmap.md`, `ProductArchitecture.md` §7/§8, `LearningExperienceArchitecture.md` §7, `HANDOFF_PROMPT.md`, and this file — all now match the actual repository state, verified by reading the code and running the test suites, not by asserting design intent.

Scalable Assessment System design review + Milestone A (2026-07-28) — before any code, reviewed the requested "Assessment Engine/teacher-ready assessments" milestone against `Product-Vision.md`'s Coaching vs. Assessment Philosophy (resolved: teacher-facing surface, student experience unchanged) and identified auth as an unstated prerequisite, sequenced as its own Milestone A. Implemented, tested, and live-verified same day; documented in [ADR-004](ADR/ADR-004-student-teacher-identity.md) and `Development-Journal.md`'s 2026-07-28 entry.

## Engineering Health

79/79 backend tests passing (65 → 79 with Milestone A's `test_auth.py`), 49/49 frontend tests passing (40 → 49). Four architecture decisions on record are implemented, not just designed — [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md) (evaluation/coaching separation), [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md) (Shadow Mode execution and logging), [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md) (content authoring and export pipeline), and [ADR-004](ADR/ADR-004-student-teacher-identity.md) (student/teacher identity) all match the shipped code, verified by diff/by reading the code, not asserted from design intent. Shadow Mode is active: the AI evaluator runs out-of-band on real traffic, and production behavior (the API response, coaching) is unchanged, proven by adversarial tests that force the shadow path to fail or be disabled. Confidence-gated live evaluation (not yet scoped or numbered) isn't blocked by anything technical or architectural — only by operational validation: Shadow Mode hasn't yet accumulated a large enough sample to answer the confidence-calibration and misconception-vocabulary questions Feature 014 left open. No known technical-debt blockers to that path; the known limitations that do exist (the `BackgroundTasks` execution model's ceiling under real concurrent traffic, JSONL's lack of query capability, and an undecided log-retention policy) are already tracked in ADR-002's Trade-offs section and aren't blocking anything today. The content pipeline (ADR-003) has its own known gap: no automated test suite for the pipeline tooling itself, and a hard runtime coupling to a co-located backend Python venv for schema validation. Milestone A (ADR-004) has its own named gaps: JSON-file account persistence won't scale past classroom volume (the database decision is deliberately deferred to Milestone B), and session security (`session_secret_key`, `https_only`) is dev-only pending a real deployment target — none of these block today's single-machine workflow.

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

---

## Completed Releases

*Feature-numbered engineering work (007–015) is preserved above; delivery from this point is organized by Release, not Feature — see `Roadmap.md`. Features are still tracked internally within a Release (e.g. Release 0.1 = Feature 016 + Feature 017); Releases describe what students receive, Features describe what engineers build.*

✓ Release 0.1 — "It Remembers You" (Feature 016 — Progress Persistence Layer, Feature 017 — Chapter Overview & Continue Learning)

**Release 0.2 (in progress) — first slice implemented**: Features 018–021 (Content Pipeline & Topic Delivery), Linear Equations migrated end-to-end (44 questions, 1 Topic, live). Not yet complete — Data Handling authored but not exported, and Release 0.2's Understand stage (per `LearningExperienceArchitecture.md`) not yet built.

---

## Current Release

**Release 0.2, first slice implemented 2026-07-27, not yet complete.** Content Pipeline & Topic Delivery (Features 018–021) shipped Linear Equations end-to-end (Learn + Worked Examples stages, per `LearningExperienceArchitecture.md`). Data Handling is authored through stage 6 (42 questions) but not exported. Release 0.1 ("It Remembers You") shipped the same day, a separate non-blocking track. Feature 015 (Shadow Mode) shipped 2026-07-23 and remains operable but hasn't yet accumulated a meaningful sample of real evaluations — see [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md).

---

## Next Engineering Objective

See `Backlog.md`'s "Recommended Next": Milestone B (server-side attempt history, next in the Scalable Assessment System sequence, needs its own design review); operate Shadow Mode and gather data (toward scoping confidence-gated live evaluation, not yet numbered); export Data Handling's already-authored 42 questions (nearest next content step). See `Roadmap.md`'s "Scalable Assessment System" section for the fuller Milestone A–F sequencing, and `ADR/ADR-001-evaluation-coaching-separation.md` / `ADR/ADR-002-shadow-mode-execution-and-logging.md` / `ADR/ADR-003-content-authoring-and-export-pipeline.md` / `ADR/ADR-004-student-teacher-identity.md` for the seams any future engineering builds on.

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

Backend

FastAPI
Topic data model & retrieval API (`GET /chapters/{chapterId}/topics`, `GET /topics/{topicId}`)
Student/teacher identity: session-cookie auth, class join codes — dormant, not yet consumed by any other route (see ADR-004)

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

Features 007–012 (`90e547b`), Feature 014's spike (`e98d744`), the Product Foundation Sprint docs (`ae27076`), Feature 015/Shadow Mode (`e0e276e`), Release 0.1 (`a1df08d`), Features 018–021/Content Pipeline (`b313d4d`), and their documentation reconciliation (`c4dc58f`) are all committed as of 2026-07-28. **Milestone A (Student/Teacher Identity) is implemented, tested, and live-verified but not yet committed** — new `app/schemas/user.py`, `app/services/auth_service.py`, `app/api/routes/auth.py`, `backend/tests/test_auth.py`, `frontend/src/types/auth.ts`, `frontend/src/services/authService.ts`, `frontend/src/pages/{TeacherAuthPage,StudentJoinPage}.{tsx,css}`, `frontend/tests/services/authService.test.ts`, `docs/ADR/ADR-004-student-teacher-identity.md`; modified `backend/{requirements.txt,.gitignore}`, `app/main.py`, `app/core/config.py`, `app/api/router.py`, `frontend/src/{App.tsx,App.css}`, `frontend/src/pages/HomePage.tsx`, and this documentation reconciliation pass.

Run `git status` before starting new work. Ask the user how/whether to commit this checkpoint before beginning any new engineering.

---

## Last Verified

Backend ✔ (79/79 pytest — 65 pre-Milestone-A, 60 pre-Feature-018, up from 47 pre-Feature-015 — see below)

Frontend ✔ (49/49 vitest, `tsc -b`, `oxlint`, `vite build` all clean — 40 pre-Milestone-A, 36 pre-Feature-018, up from 18 pre-Release-0.1)

Milestone A ✔ (live, 2026-07-28: teacher register → create class → join code; student join with that code → success; student re-login with correct PIN → success; wrong PIN → rejected with no session granted; pre-existing anonymous Home → Select Chapter flow re-verified working identically with and without a session cookie present)

Content pipeline ✔ (re-verified 2026-07-28: `node docs/content-pipeline/export/run.js --chapter=linear-equations --dry-run` reports 44 questions/1 topic/44 answer keys, zero validation errors, against the current `backend/.venv` Pydantic schemas)

Tests ✔

Build ✔

Feature 014 (spike, not production) verified on its own terms: harness ran all 30 dataset samples against `qwen2.5:7b-instruct` via local Ollama — 100% valid JSON, 100% schema-valid, 93% correctness agreement with hand-labeled ground truth, mean latency 39.3s on CPU-only hardware. See `backend/experiments/ai_evaluation/README.md` for full results and limitations.

Feature 015 (Shadow Mode, production code, zero user-facing effect) verified via 13 new tests: every pre-existing exact-response-body assertion in `test_answers.py` passes unmodified (the regression proof the API contract didn't move), plus adversarial tests forcing the shadow evaluator to fail (`RuntimeError`) and to be disabled (`shadow_mode_enabled=False`), both asserting the response is unaffected. No browser walkthrough applicable — no UI surface changed.

Release 0.1 (Feature 016 + Feature 017, frontend, first genuinely user-visible change since Feature 011) verified via 18 new frontend tests plus live browser walkthroughs with both servers running: an existing-progress profile resuming at the correct chapter/question, a freshly cleared profile falling back correctly to Chapter Selection, a mobile-viewport (375px) check confirming no layout overflow, and backend `pytest` re-run fresh (60/60) to confirm zero backend impact.
