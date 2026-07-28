# Current Milestone

This file tracks two separate tracks that move at different speeds — don't conflate them.

## Engineering Milestone

Milestone 2 – Coaching Engine, extended by Release 0.2's first slice (Content Pipeline & Topic Delivery)

## Documentation Milestone

Product Foundation Sprint (2026-07-23) — matured `Product-Vision.md`, `ProductArchitecture.md`, `Backlog.md`; added `Roadmap.md`, `Idea-Inbox.md`, and the project's first real ADR (ADR-001). No code changed. See `Development-Journal.md` if this sprint later needs its own entry, and the Product Foundation Sprint Report for the full summary.

Release 0.1 documentation closeout (2026-07-27) — added `docs/LearningExperienceArchitecture.md` (previously chat-only, now a permanent document) and the Release 0.1 entries across `Development-Journal.md`, `Release-Notes.md`, `Roadmap.md`, `Backlog.md`, `ProductArchitecture.md` (new §6), `Wireframes.md`, and this file.

Content Pipeline reconciliation (2026-07-28) — Features 018–021 (Topic data model/API, Template Engine v1, content authoring pipeline, Stage 10 Export Pipeline) had been implemented and verified on 2026-07-27 but left undocumented and uncommitted. Backfilled: [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md), `Development-Journal.md`, `Backlog.md`, `Roadmap.md`, `ProductArchitecture.md` §7/§8, `LearningExperienceArchitecture.md` §7, `HANDOFF_PROMPT.md`, and this file — all now match the actual repository state, verified by reading the code and running the test suites, not by asserting design intent.

## Engineering Health

65/65 backend tests passing (60 → 65 with Feature 018's `test_topics.py`), 40/40 frontend tests passing (36 → 40). Three architecture decisions on record are implemented, not just designed — [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md) (evaluation/coaching separation), [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md) (Shadow Mode execution and logging), and [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md) (content authoring and export pipeline) all match the shipped code, verified by diff/by reading the code, not asserted from design intent. Shadow Mode is active: the AI evaluator runs out-of-band on real traffic, and production behavior (the API response, coaching) is unchanged, proven by adversarial tests that force the shadow path to fail or be disabled. Confidence-gated live evaluation (not yet scoped or numbered) isn't blocked by anything technical or architectural — only by operational validation: Shadow Mode hasn't yet accumulated a large enough sample to answer the confidence-calibration and misconception-vocabulary questions Feature 014 left open. No known technical-debt blockers to that path; the known limitations that do exist (the `BackgroundTasks` execution model's ceiling under real concurrent traffic, JSONL's lack of query capability, and an undecided log-retention policy) are already tracked in ADR-002's Trade-offs section and aren't blocking anything today. The content pipeline (ADR-003) has its own known gap: no automated test suite for the pipeline tooling itself, and a hard runtime coupling to a co-located backend Python venv for schema validation — both named in ADR-003's Trade-offs, neither blocking today's single-machine workflow.

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

See `Backlog.md`'s "Recommended Next": operate Shadow Mode and gather data (toward scoping confidence-gated live evaluation, not yet numbered); export Data Handling's already-authored 42 questions (nearest next content step); and get the current checkpoint committed (nothing since `ae27076` is in git — see "Uncommitted Work" below). See `Roadmap.md` for the fuller sequencing, and `ADR/ADR-001-evaluation-coaching-separation.md` / `ADR/ADR-002-shadow-mode-execution-and-logging.md` / `ADR/ADR-003-content-authoring-and-export-pipeline.md` for the seams any future engineering builds on.

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

Features 007–012 are committed (through commit `90e547b`); Feature 014's spike (`backend/experiments/ai_evaluation/`) is committed separately (`e98d744`); the Product Foundation Sprint documentation (2026-07-23) is committed (`ae27076`). As of this checkpoint, everything below is uncommitted — nothing has been committed since `ae27076`:

- **Feature 015 (Shadow Mode), backend-only**: new `app/services/{ai_evaluation_client,ai_evaluation_prompt,ai_evaluation_service,shadow_evaluation_service,shadow_log_writer}.py`, `app/schemas/ai_evaluation.py`, matching test files; modified `app/services/evaluation_service.py`, `app/api/routes/answers.py`, `app/core/config.py`, `.gitignore`, `tests/test_answers.py`, `tests/test_evaluation_service.py`.
- **Release 0.1 (Feature 016 + Feature 017), frontend-only**: new `frontend/src/services/{progressService,progressStore}.ts`, `frontend/src/types/progress.ts`, matching test files; modified `frontend/src/pages/{QuestionPage,ChapterPage,HomePage}.tsx`, `frontend/src/components/ChapterCard.{tsx,css}`, `frontend/tests/components/ChapterCard.test.tsx`.
- **Features 018–021 (Content Pipeline & Topic Delivery)**: new `app/schemas/topic.py`, `app/services/topic_service.py`, `app/api/routes/topics.py`, matching test file; `frontend/src/pages/TopicPage.{tsx,css}`, `frontend/src/types/topic.ts`; new `docs/content-pipeline/{template-engine,export}/*` and `docs/content-source/{linear-equations,data-handling}/*`; modified `app/schemas/question.py` (`topicId`), `app/api/router.py`, `backend/app/data/{questions,answer_keys}.json` (Linear Equations re-exported), `frontend/src/App.tsx`, `frontend/src/pages/ChapterPage.tsx`, `frontend/src/services/questionService.ts`.
- **Documentation**: new `docs/ADR/{ADR-002-shadow-mode-execution-and-logging,ADR-003-content-authoring-and-export-pipeline}.md`, `docs/LearningExperienceArchitecture.md`; modified `docs/{Development-Journal,Backlog,Roadmap,PROJECT_STATUS,Product-Vision,ProductArchitecture,Release-Notes,Wireframes,HANDOFF_PROMPT,README,ADR/ADR-001-evaluation-coaching-separation}.md`.

Run `git status` before starting new work. Ask the user how/whether to commit this checkpoint before beginning any new engineering.

---

## Last Verified

Backend ✔ (65/65 pytest — 60 pre-Feature-018, up from 47 pre-Feature-015 — see below)

Frontend ✔ (40/40 vitest, `tsc -b`, `oxlint`, `vite build` all clean — 36 pre-Feature-018, up from 18 pre-Release-0.1)

Content pipeline ✔ (re-verified 2026-07-28: `node docs/content-pipeline/export/run.js --chapter=linear-equations --dry-run` reports 44 questions/1 topic/44 answer keys, zero validation errors, against the current `backend/.venv` Pydantic schemas)

Tests ✔

Build ✔

Feature 014 (spike, not production) verified on its own terms: harness ran all 30 dataset samples against `qwen2.5:7b-instruct` via local Ollama — 100% valid JSON, 100% schema-valid, 93% correctness agreement with hand-labeled ground truth, mean latency 39.3s on CPU-only hardware. See `backend/experiments/ai_evaluation/README.md` for full results and limitations.

Feature 015 (Shadow Mode, production code, zero user-facing effect) verified via 13 new tests: every pre-existing exact-response-body assertion in `test_answers.py` passes unmodified (the regression proof the API contract didn't move), plus adversarial tests forcing the shadow evaluator to fail (`RuntimeError`) and to be disabled (`shadow_mode_enabled=False`), both asserting the response is unaffected. No browser walkthrough applicable — no UI surface changed.

Release 0.1 (Feature 016 + Feature 017, frontend, first genuinely user-visible change since Feature 011) verified via 18 new frontend tests plus live browser walkthroughs with both servers running: an existing-progress profile resuming at the correct chapter/question, a freshly cleared profile falling back correctly to Chapter Selection, a mobile-viewport (375px) check confirming no layout overflow, and backend `pytest` re-run fresh (60/60) to confirm zero backend impact.
