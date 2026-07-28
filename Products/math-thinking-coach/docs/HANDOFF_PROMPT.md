# Handoff Prompt — Math Thinking Coach

*Paste this document as the first message of a new chat to resume work with minimal re-explanation. This file is part of the repository — the repository is the source of truth; where anything below conflicts with what you observe in the code, trust the code and treat this document as stale. Regenerate it at the next stable checkpoint rather than letting it drift.*

---

## 1. Who you are on this project

You are the Senior Software Engineer inside the **AI Builder Operating System**, a multi-product workspace at `C:\Users\rbala\BuilderWorkspace`. Read these first — short, and this handoff doesn't replace them:

1. [`AI-Builder-OS/CLAUDE.md`](../../../AI-Builder-OS/CLAUDE.md) — role, workflow, hard rules. Key ones: don't redefine architecture or product direction unless asked; implement only agreed scope; verify build/lint/tests before calling anything done; commit only after verification. Also defines the **Engineering vs. Product documentation** split: `Development-Journal.md`, `Release-Notes.md`, and accepted ADRs describe only completed reality; `Product-Vision.md`, `Roadmap.md`, and `Idea-Inbox.md` are intentionally forward-looking and exempt from that rule; `Backlog.md` holds approved-but-unscheduled work only.
2. [`AI-Builder-OS/ENGINEERING_PRINCIPLES.md`](../../../AI-Builder-OS/ENGINEERING_PRINCIPLES.md) — simplicity over cleverness, reuse through need, small commits, fix root causes.
3. [`AI-Builder-OS/DOCUMENTATION_STANDARDS.md`](../../../AI-Builder-OS/DOCUMENTATION_STANDARDS.md) — what each doc file is for (§10 below) and when to update it.
4. [`Products/math-thinking-coach/prompts/AI_Coding_Standards.md`](../prompts/AI_Coding_Standards.md) — no new top-level folders or dependencies without approval, mirror source structure in tests, never move/delete files unless instructed.

This project (`Products/math-thinking-coach/`) is one product in that workspace. `AI-Builder-OS/CHATGPT_PLAYBOOK.md` describes a ChatGPT-plans / Claude-implements workflow you may see feature specs arrive from — treat them as the user's request, not something to originate yourself.

---

## 2. Product vision and pedagogy

An AI-powered **Math Thinking Coach** for Class 8 CBSE students, evolving toward an **AI Learning Companion**: guide students to *think through* problems, and — as of the direction set alongside Release 0.1 — teach them, not just quiz them. Full detail in two documents with distinct, non-overlapping jobs:

- [`Product-Vision.md`](Product-Vision.md) — why the product exists: mission, target audience, coaching-vs-assessment philosophy, curriculum integrity, extensibility principles.
- [`LearningExperienceArchitecture.md`](LearningExperienceArchitecture.md) — **how students learn**, the pedagogical counterpart to this document. Defines the full learning journey (Learn → Understand → Worked Examples → Guided Practice → Independent Practice → Homework → Revision → Mastery), the `Topic` model, what's AI-authored (always offline, human-reviewed) vs. deterministic, and which Release delivers which stage. Read this before proposing any Release 0.2+ feature — find its stage there first.

---

## 3. Architectural decisions (read before touching evaluation, AI, or persistence code)

**[ADR-001](ADR/ADR-001-evaluation-coaching-separation.md) — Evaluation/Coaching separation (Accepted).** `answer_service.evaluate_answer` is a thin orchestrator over two independent collaborators: `evaluation_service.evaluate()` (correctness only) and `coaching_service.decide()` (attempt-based coaching only). This seam is *the* extension point for any future evaluation strategy.

**[ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md) — Shadow Mode execution and logging (Accepted).** An experimental AI evaluator runs out-of-band (FastAPI `BackgroundTasks`) alongside the rule-based evaluator on every real answer submission, logging one JSONL record per submission. Zero production behavior change — enforced and verified, not just intended. Feature-flagged via `SHADOW_MODE_ENABLED` (default on).

**[ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md) — Content authoring and export pipeline (Accepted).** New content is authored in `docs/content-source/<chapter>/` (a 5-stage trail, `reviewStatus`-gated) and, once approved, merged into runtime `backend/app/data/*.json` by a 7-phase Stage 10 Export Pipeline (`docs/content-pipeline/export/`) that validates against the real backend Pydantic schemas and writes atomically, per-chapter, never a whole-file overwrite. A companion "Template Engine v1" (`docs/content-pipeline/template-engine/`) generates and independently verifies question candidates at volume. This is how Linear Equations grew from 5 to 44 questions and gained its Topic.

**[ADR-004](ADR/ADR-004-student-teacher-identity.md) — Student/teacher identity (Accepted).** Minimal auth: teacher accounts (email/password), a class join-code system, and student identity via that code + display name + a short PIN — deliberately no student email/password collected, since students are minors. HTTP-only signed session cookie (Starlette `SessionMiddleware`), JSON-file persistence (mirrors `chapters.json`/`topics.json`), existing content routes left completely open. First milestone of the "Scalable Assessment System" — see `Roadmap.md`.

**[ADR-005](ADR/ADR-005-server-side-attempt-history.md) — Server-side attempt history (Accepted).** Resolves ADR-004's deferred persistence question: SQLite (`sqlite3` stdlib, zero new dependency), one `attempts` table, recorded via `BackgroundTasks` only when a student session exists (ADR-004). This is what makes identity non-dormant. A real bug was caught during this ADR's own live verification: attempt recording was originally registered *after* Shadow Mode's background task, and `BackgroundTasks` runs sequentially — every write was queuing behind Shadow Mode's 40-90s local Ollama call. Fixed by reordering; read the ADR's Decision section before adding anything else to the `/answer` route's background dispatch.

**Release 0.1's frontend persistence pattern (not yet its own ADR — see §11).** `progressService.ts` is the only interface any component uses; `progressStore.ts` is the only file that touches `localStorage`. Mirrors ADR-001's service-in-front-of-private-accessor shape, applied to the frontend for the first time. See `ProductArchitecture.md` §6.

**Learning Session Engine, Milestone C1 (implemented, not yet an ADR).** Six deterministic backend modules — `learning_context_service`, `session_planner`, `constraint_resolver`, `content_repository`, `question_selector`, `session_planning_pipeline` — implementing the stateless half of a design-reviewed session-planning architecture (three review iterations: blueprint, refinement, final domain-model validation, all before code). No API routes, no session persistence — that was C2's job. Read `Development-Journal.md`'s 2026-07-28 (Milestone C1) entry before touching any of these six modules — it names two implementation decisions (uniform tier-backfill regardless of request shape; `questionTypes` as a documented no-op) that materially affected C2's design.

**Learning Session Engine, Milestone C2 (implemented, not yet an ADR).** The stateful half: `session_store.py` (SQLite persistence, `sessions` table in `runtime.db` — `attempts.db` was renamed in this same change since the file now holds both tables), `session_builder.py` (one-time session creation, calls C1's pipeline then persists), `content_repository.get_question_content()` (the second, serving-time content path — Runtime Session Manager never imports `question_service` directly), `runtime_session_manager.py` (`get_current_question`/`submit_answer`, lazy `expired`/`abandoned` lifecycle transitions checked on access with no scheduler, server-derived attempt numbers, a position guard against stale concurrent submissions), and four new routes under `routes/sessions.py`. Also design-reviewed across three rounds (blueprint, critical review of 6 specific questions, final consolidation) before code. 198/198 tests, all new test files passed on first run. **Deliberately no ADR-006/007 yet**: this project's ADRs record shipped decisions; both are scoped and now writable but weren't requested during the implementation session. Read `Development-Journal.md`'s 2026-07-28 (Milestone C2) entry before touching any of these modules — it names implementation-discovered decisions: `submit_answer` advances on `SHOW_SOLUTION` as well as `NEXT_QUESTION` (there's no separate "acknowledge" endpoint); `hintsUsedTotal` is reserved but always 0; the accepted-in-design degradation-policy refinement was deliberately not implemented (flagged for Milestone E).

All five accepted ADRs record real, implemented decisions, verified against shipped code — not proposals. Before touching evaluation, Shadow Mode, the progress-persistence layer, content authoring/export, auth, attempt history, or either half of the Learning Session Engine, read the relevant section in full first.

---

## 4. Current architecture

**Stack** — Frontend: React 19 + TypeScript + Vite, React Router, Vitest + Testing Library, oxlint. Backend: Python 3.13, FastAPI, Pydantic, `sqlite3` (stdlib), pytest + httpx. REST/JSON under `/api/v1`. AI: rule-based evaluation drives coaching (unchanged since Feature 010); an AI evaluator also runs in production, out-of-band, logging-only (Feature 015). No AI is in the response path. Content is still file-based (no DB); Milestone A's accounts are JSON-file-based (`backend/app/data/{teachers,classes,students}.json`, gitignored); Milestone B's attempt history and Milestone C2's session runtime share one SQLite file, `backend/app/data/runtime.db` (gitignored, renamed from `attempts.db` in the C2 change) — the first real database in this project. Release 0.1's client-side progress tracking (`localStorage`) is unaffected and remains the path for anonymous use. Content authoring/export tooling (Node.js, `docs/content-pipeline/`) is build-time only, never imported by `app/*` or `frontend/src/*` — see ADR-003. Auth (ADR-004) gates `/auth/*`, `/performance/me`, and the new `/sessions/*` routes; every content route and the standalone answer-evaluation route are still open with no session required.

**Backend** (`backend/app/`)
```
main.py                        FastAPI app, CORS (localhost:5173 only), SessionMiddleware (ADR-004), mounts
                                api_router at /api/v1
api/router.py, api/routes/     health, chapters, questions, topics, answers, auth, performance, sessions — routes
                                stay thin, delegate to services
core/config.py                 Settings: app + api_prefix + five shadow_* settings + session_secret_key (all
                                env-driven)
core/logging.py                basic logging config
data/                          chapters.json, questions.json (public, topicId optional), topics.json (public),
                                answer_keys.json (private, one reader), {teachers,classes,students}.json
                                (gitignored, ADR-004), runtime.db (gitignored, SQLite, ADR-005 attempts table +
                                Milestone C2 sessions table — renamed from attempts.db)
schemas/                       Pydantic models: chapter, question, topic, answer, ai_evaluation, user, performance,
                                session (Milestone C1 — AssessmentRequest, StudentLearningContext, SessionPlan,
                                SelectionConstraints, QuestionCandidate, SelectedQuestion, SelectionOutcome;
                                Milestone C2 — SessionState, LearningSession, CreateSessionRequest/Response,
                                QuestionContent, CurrentQuestionResponse, SessionTerminalResponse,
                                SubmitSessionAnswerRequest/Response, SessionSummaryResponse)
services/
  question_service.py          content lookup
  topic_service.py             Topic lookup (Feature 018) — same load-once-module-level pattern as question_service
  evaluation_service.py        rule-based correctness + get_expected_answer() accessor (ADR-001/002)
  coaching_service.py          attempt-based coaching logic — untouched by Shadow Mode, Release 0.1, Features 018–021
  answer_service.py            thin orchestrator — untouched by Shadow Mode, Release 0.1, Features 018–021
  ai_evaluation_{client,prompt,service}.py   Shadow Mode's AI evaluator (promoted from the Feature 014 spike)
  shadow_evaluation_service.py Shadow Mode's out-of-band orchestrator, dispatched via BackgroundTasks
  shadow_log_writer.py         thread-safe JSONL append
  auth_service.py              Milestone A (ADR-004) — bcrypt hashing, atomic JSON-file read/write under a lock
  attempt_service.py           Milestone B (ADR-005) — SQLite attempt log + deterministic per-topic aggregates;
                                Milestone C1 added get_recent_question_ids() (read-only); DB_PATH now points at
                                runtime.db (Milestone C2 rename)
  learning_context_service.py  Milestone C1 — StudentLearningContext, built fresh from attempt_service on every call
  session_planner.py           Milestone C1 — AssessmentRequest + context -> SessionPlan, mode as a strategy branch
  constraint_resolver.py       Milestone C1 — SessionPlan + pool -> SelectionConstraints, deterministic degradation
  content_repository.py        Milestone C1 — wraps question_service, exposes QuestionCandidate only; Milestone C2
                                added get_question_content() — the second, full-content, serving-time entry point
  question_selector.py         Milestone C1 — SelectionConstraints + candidates -> SelectionOutcome, seeded
  session_planning_pipeline.py Milestone C1 — thin composition of the five above; consumed directly by C2's
                                session_builder.py, not superseded by it
  session_store.py             Milestone C2 — SQLite persistence for LearningSession (runtime.db, sessions table),
                                single threading.Lock, update_session_state() structurally cannot touch immutable
                                plan/selected-questions columns
  session_builder.py           Milestone C2 — one-time session creation: runs C1's pipeline, then persists via
                                session_store; sessionId adopts plan.planId, no second UUID
  runtime_session_manager.py   Milestone C2 — get_current_question/submit_answer, lazy expired/abandoned lifecycle
                                checks (no scheduler), server-derived attempt numbers, ownership check returns 404
                                for both "doesn't exist" and "not yours"
experiments/ai_evaluation/     Feature 014's original harness — untouched, not imported by app/*
tests/                         pytest, one file per module — 198/198 passing
```

**Content pipeline** (`docs/`, build-time only — see [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md))
```
content-source/<chapter>/      Authoring trail: stage2 (topic detection) .. stage6 (questions), canonical-topic.json.
                                reviewStatus-gated ("ai-generated" default, "approved" required to export).
content-pipeline/
  template-engine/             Feature 019 — seeded, validated procedural question generation (node run.js ...)
  export/                      Feature 021 — Stage 10 Export: 7-phase gated merge into backend/app/data/*.json
                                (node run.js --chapter=<slug> [--dry-run]); shells out to backend/.venv for real
                                Pydantic validation. No automated test suite for this tooling itself.
```

**Frontend** (`frontend/src/`)
```
pages/         Home, ChapterSelection, Chapter (repurposed as Chapter Overview — Release 0.1; now also routes into
                Topic when one exists — Feature 018), Question, Topic (Feature 018 — explanation, worked example,
                learning objectives, "Start Practice"), TeacherAuthPage/StudentJoinPage (Milestone A, ADR-004 —
                reachable from Home, not gating anything)
components/    ChapterCard (progress badge — Release 0.1), AnswerInput, HintPanel, SolutionPanel,
               DifficultyBadge, ProgressBar, QuestionProgress
services/
  questionService.ts   the only place components fetch content — async, fetch-based; now also getTopics/getTopic
  progressService.ts   Release 0.1 — the only interface for progress (localStorage-backed)
  progressStore.ts     Release 0.1 — the only file that touches localStorage; never imported outside progressService
  authService.ts       Milestone A — the only interface for auth calls; every call sends credentials: 'include'
types/         chapter, question, answer, progress (Release 0.1), topic (Feature 018), auth (Milestone A) —
               hand-kept in parity with backend schemas where applicable
config/api.ts
tests/         mirrors src/ 1:1 for components and services; no page-level tests (verified via live walkthrough instead)
```

**Data flow** — `backend/app/data/*.json` is the single source of truth for content; frontend has no local copies. `answer_keys.json` is private, read only through `evaluation_service.get_expected_answer()`. New content originates in `docs/content-source/`, not by hand-editing `backend/app/data/*.json` directly, once a chapter has been migrated onto the pipeline (Linear Equations only, so far — Data Handling, Practical Geometry, Understanding Quadrilaterals, and Rational Numbers still carry their original hand-seeded questions). Progress lives entirely in the browser (`localStorage`, key `mtc.progress.v1`, schema-versioned) — no server-side record, no multi-device sync (unchanged by Milestone A — accounts exist now, but nothing wires them to progress yet; that's Milestone B).

---

## 5. Development workflow on this project

1. **Design** — grounded in the actual current repo, not assumptions. No code.
2. **Review** — the user challenges the recommendation, asks for specific confirmations, sometimes redirects mid-review.
3. **Approval** — explicit, before any code is written.
4. **Small implementation slices** — each independently testable, not one large diff.
5. **Tests** — every slice ships with tests; adversarial tests (force a failure, force a disabled state) matter as much as happy-path ones for anything touching a response contract.
6. **Documentation** — updated after implementation and verification, describing what was actually built, plus a new ADR if the decision is significant and hard to reverse.
7. **Final verification** — a real end-to-end review before calling a Feature or Release complete: re-run tests fresh (don't trust earlier slices' results), check for dead code/stale comments/duplication, live-verify UI-observable changes.

Don't skip steps 1–3 by jumping to implementation on a request that reads like a spec.

---

## 6. Current project status

- **Release 0.1 ("It Remembers You") is complete** — Feature 016 (Progress Persistence Layer) + Feature 017 (Chapter Overview & Continue Learning).
- **Release 0.2, first slice implemented (not complete)** — Features 018–021 (Topic data model & API, Template Engine v1, content authoring pipeline, Stage 10 Export Pipeline — see [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md)), shipped in parallel with Release 0.1 the same day. Linear Equations migrated end-to-end (5 → 44 questions, 1 Topic, live). Data Handling authored through stage 6 (42 questions) but not exported. Release 0.2's Understand stage not yet built.
- **Scalable Assessment System, Milestones A, B, C1, and C2 implemented (2026-07-28)** — student/teacher identity ([ADR-004](ADR/ADR-004-student-teacher-identity.md)), server-side attempt history ([ADR-005](ADR/ADR-005-server-side-attempt-history.md)), and both halves of the Learning Session Engine (no ADR yet — see §3). All design-reviewed before code: the requested "Assessment Engine/teacher-ready assessments" language was checked against `Product-Vision.md`'s Coaching vs. Assessment Philosophy — resolved via an explicit, narrow addendum (Test mode is opt-in and self-feedback-framed; default coaching stays score-free); the Question Selection Engine (P3) was elevated, after three review iterations, to a full Learning Session Engine, then split into C1 (stateless) and C2 (stateful) along the persistence-decision boundary — both now complete, each went through its own blueprint → critical review → final consolidation design cycle before implementation. Milestone A no longer dormant — Milestone B records real attempts for logged-in students; C1 plans sessions from that data; C2 persists and serves them one question at a time via four new routes. Question 1 and question 10 are now served by the same code path — the complete question bank is never returned to the client. Milestones E, F are sequenced in `Roadmap.md` but **not implemented** — each needs its own implementation-ready design review, same as every milestone before it got.
- **198/198 backend tests, 49/49 frontend tests passing.**
- **Feature 015 (Shadow Mode)** shipped 2026-07-23, still operable, still hasn't accumulated a meaningful sample.
- **Next engineering objective**: none formally queued. Active, non-blocking tracks: write ADR-006 (C1)/ADR-007 (C2), now that the full Learning Session Engine is implemented, tested, and live-verified; a frontend for the Learning Session Engine (no UI exists for any `/sessions/*` route yet); P1's Question-page UX fixes (independent, addresses a concrete measured crowding problem); operate Shadow Mode and gather data; export Data Handling's already-authored questions. Don't assume further engineering is approved to start — see §11/§11.6.
- **Branch**: `main`, ahead of `origin/main`, nothing pushed. **Committed**: everything up to and including Milestone C1. **Uncommitted**: Milestone C2 (backend `app/services/{session_store,session_builder,runtime_session_manager}.py`, `app/api/routes/sessions.py` and matching tests; modified `app/schemas/session.py`, `app/services/attempt_service.py` (`runtime.db` rename), `app/services/content_repository.py` (`get_question_content`), `app/api/router.py`, `backend/.gitignore`; this documentation pass). Run `git status` to confirm before doing anything; ask the user whether/how to commit.

Run `pytest` and `vitest run` yourself and re-check `git status`/`git log` before trusting any number above. This checkpoint's own history has cautionary examples worth remembering: Features 018–021 were implemented and verified on 2026-07-27 but left undocumented and uncommitted until a 2026-07-28 reconciliation pass caught the gap; Milestone B's own live verification caught a real background-task ordering bug that the (green) test suite alone did not — the test fixture stubs Shadow Mode's network call to be instant, so it couldn't reveal a delay that only exists when the real call is slow; Milestone C1's own test-writing caught a design ambiguity (whether tier-backfill should apply to an explicitly single-tier request) that no prior design review had pinned down — resolved during implementation, documented in `constraint_resolver.py` and the journal, not silently decided. Milestone C2, by contrast, had every new test file pass on its first run — evidence the two extra design-review rounds (critical review + final consolidation) earned their cost. Don't trust a green suite alone for anything involving `BackgroundTasks` timing — verify live.

---

## 7. Repository conventions and coding standards

- Ask before assuming when a spec conflicts with existing architecture — stop and clarify.
- Minimal, focused diffs. Don't refactor unrelated code. Don't rename/move files unless asked.
- No new dependencies or top-level folders without justification and approval.
- Routes/components stay thin; business logic lives in services (backend `app/services/*.py`, frontend `src/services/*.ts`) — followed with zero exceptions so far, on both sides.
- Python: Pydantic models for every request/response shape, `response_model=` on every route. Plain function modules for services, not classes.
- TypeScript: strongly typed; plain function modules exported as one object literal (`export const xService = {...}`), not classes — same convention on both `questionService.ts` and `progressService.ts`.
- No comments explaining *what* code does — only genuinely non-obvious constraints.
- Commit messages: Conventional Commits (`feat(scope): ...`, `refactor(scope): ...`, `docs: ...`). Only commit when the user asks, only after tests are green, and per Release 0.1's practice: code and the documentation describing it belong in the same commit (`CLAUDE.md`'s Documentation Responsibility treats docs as part of Definition of Done).
- **Releases vs. Features**: Releases (`Roadmap.md`, `Backlog.md`, `PROJECT_STATUS.md`) describe what students receive; Features (`Development-Journal.md`, one entry per Feature) describe what engineers build, tracked *inside* a Release (e.g. Release 0.1 = Feature 016 + Feature 017). Features 007–015 predate this convention and are never renumbered.

---

## 8. Current REST API surface

```
GET  /api/v1/health
GET  /api/v1/chapters
GET  /api/v1/chapters/{chapterId}                          → 404 if unknown
GET  /api/v1/chapters/{chapterId}/questions                → 404 if chapter unknown
GET  /api/v1/chapters/{chapterId}/questions/{questionId}   → 404 if chapter or question unknown
GET  /api/v1/chapters/{chapterId}/topics                   → 404 if chapter unknown, [] if chapter has no topics
GET  /api/v1/topics/{topicId}                               → 404 if unknown

POST /api/v1/questions/{questionId}/answer                 → 404 if question unknown, 422 on invalid body
  Request:  { "submission": { "answer": string, "attemptNumber": number } }
  Response: {
    "evaluation": { "isCorrect": boolean, "score": 1.0 | 0.0 },
    "coach": { "message": string, "nextAction": "TRY_AGAIN" | "SHOW_HINT" | "SHOW_SOLUTION" | "NEXT_QUESTION" },
    "ui": { "canTryAgain": boolean, "canRevealSolution": boolean, "hintLevel": 0 | 1 | 2 }
  }

POST /api/v1/auth/teacher/register                         → 400 on duplicate email or weak password
POST /api/v1/auth/teacher/login                             → 401 on bad credentials
POST /api/v1/auth/teacher/classes                           → 401 without a teacher session
POST /api/v1/auth/student/join                               → 400 on unknown class code or duplicate name in class
POST /api/v1/auth/student/login                              → 401 on bad class code/name/PIN
POST /api/v1/auth/logout
GET  /api/v1/auth/me                                         → 401 if not logged in

GET  /api/v1/performance/me                                  → 401 if not a student session
  Response: [{ "topicId": string, "questionsAttempted": number, "questionsCorrect": number,
                "accuracy": number, "currentStreak": number, "mastered": boolean }, ...]

POST /api/v1/sessions                                        → 401 if not a student session, 400 if the
                                                                 configuration yields zero selectable questions,
                                                                 422 on invalid body (e.g. timeLimitMinutes <= 0)
  Request:  { "chapterId": string, "mode": "practice"|"test"|"revision", "difficulty"?: string,
              "questionTypes"?: string[], "questionCount"?: number, "timeLimitMinutes"?: number }
  Response: { "sessionId": string, "targetCount": number, "actualCount": number, "shortfall": boolean }
  Returns summary fields only — the client always calls GET .../current-question next; no question content here.

GET  /api/v1/sessions/{sessionId}/current-question            → 401 if not a student session, 404 if unknown or
                                                                 not this student's session, 409 if the session
                                                                 is in a terminal state (completed/expired/abandoned)
  Response: { "position": number, "totalCount": number,
              "question": { "id", "question", "text", "difficulty", "hints"[], "solution" } }
  409 body: { "sessionId", "status", "position", "totalCount", "correctCount" }
  Side-effect-free — safe to call repeatedly (resume/refresh).

POST /api/v1/sessions/{sessionId}/answer                      → 401/404 as above, 409 on a stale position (the
                                                                 client's echoed position no longer matches server
                                                                 state — e.g. a second tab) or a terminal session
  Request:  { "position": number, "answer": string }           (no attemptNumber — server-derived, never trusted)
  Response: { "evaluation": {...}, "coach": {...}, "ui": {...}, "position": number, "totalCount": number,
              "sessionStatus": string }

GET  /api/v1/sessions/{sessionId}                              → 401/404 as above
  Response: { "sessionId", "mode", "status", "position", "totalCount", "correctCount", "startedAt", "completedAt" }
```
The answer-evaluation contract is unchanged by Feature 015, Release 0.1, Features 018–021, Milestone B, or Milestone C2 — all additive and/or out-of-band. `Chapter`: `{id, title, description}`. `Question`: `{id, chapterId, question, text, difficulty, hints[], solution, topicId}` — `topicId` (Feature 018) is optional and never includes an expected/short answer. `Topic`: `{id, chapterId, title, explanation, workedExampleContent, learningObjectives[]}`. All `/auth/*` routes, `/performance/me`, and `/sessions/*` are session-gated (ADR-004/005, Milestone C2) and don't gate anything else — every content route and the standalone answer route above them is still open with no session required. Client-side `localStorage` progress tracking (§4) is unaffected and remains the path for anonymous use. Position is 0-indexed throughout the `/sessions/*` surface, deliberately — a 1-indexed display is a frontend concern, out of scope here.

---

## 9. Testing approach

Backend: pytest + `TestClient`, one file per module, 198/198 passing. `test_auth.py`/`test_answers.py`/`test_performance.py`/`test_sessions_api.py` use a module-level `TestClient` shared across tests — the fixture clears its cookie jar before every test to avoid session state leaking across test-order (a real bug caught during Milestone A's own implementation, not a hypothetical). Milestone C1's tests are pure `pytest` with no `TestClient` at all — every one of the six modules is a plain function over its inputs, no HTTP layer to isolate; several tests assert against real content (Linear Equations' actual 14/16/14 difficulty split, Rational Numbers' actual 3/2/0), not just synthetic fixtures, and `session_planner.py` has a dedicated test that parses its own source as an AST to enforce "never imports content-access modules" as a real invariant, not just a comment. Milestone C2's tests span three layers: `test_session_store.py`/`test_session_builder.py` are plain `pytest` (no HTTP), `test_runtime_session_manager.py` (24 tests) exercises the manager directly against real `rational-numbers` content with hardcoded answers and a `_backdate()` helper to manipulate timestamps for lifecycle testing, and `test_sessions_api.py` (11 tests) is full `TestClient`-level, including a complete 5-question walkthrough of the same chapter through the actual API. All four new C2 test files passed on their first run. Frontend: Vitest + Testing Library, `tests/` mirrors `src/` for components and services 1:1 — **no page-level tests exist anywhere in this repo**, by established convention; page behavior (`HomePage`, `ChapterPage`, `QuestionPage`, `TopicPage`, `TeacherAuthPage`, `StudentJoinPage`) is verified via live browser walkthrough instead, every time — no frontend exists yet for the `/sessions/*` API. Before calling anything done: backend `pytest`; frontend `tsc -b` + `oxlint` + `vitest run`; a live walkthrough with both servers running for anything UI-observable, including a fresh-profile *and* an existing-state path when persistence is involved (Release 0.1 established this pattern; Milestone C2's own live verification used `curl` against a running server, since there's no UI to click through yet). Re-run the full suite fresh at a Feature/Release boundary — don't trust results from earlier slices. **The content pipeline (`docs/content-pipeline/`) has no automated test suite of its own** (ADR-003) — verify it with `node docs/content-pipeline/export/run.js --chapter=<slug> --dry-run` before trusting its output. **Anything involving `BackgroundTasks` needs a live check, not just green tests** — Milestone B's own test suite passed 94/94 while a real ordering bug (attempt recording queued behind Shadow Mode's slow AI call) went undetected, because the test fixture stubs that call to be instant. If you add a third background task to the `/answer` route, verify its timing live against a real (not stubbed) Shadow Mode call before trusting it.

---

## 10. Documentation map

| File | Purpose | State |
|---|---|---|
| `Product-Vision.md` | Why the product exists — living | Current, includes 2026-07-28 Test-mode addendum |
| `ProductArchitecture.md` | How it's built — stack, folders, API, Progress Persistence, Content Architecture, Identity, Attempt History, Learning Session Engine (planning + runtime) | Current through Milestone C2 |
| `LearningExperienceArchitecture.md` | How students learn — pedagogical counterpart to ProductArchitecture.md | Current |
| `Roadmap.md` | Phased capability themes — living | Current through the Scalable Assessment System's Milestone A/B/C1/C2 |
| `Idea-Inbox.md` | Raw, unfiltered, append-only ideas — living | Current |
| `Backlog.md` | Approved future work only | Current |
| `Development-Journal.md` | Append-only engineering diary | Current through 2026-07-28 (Features 016–021, Milestones A, B, C1, and C2) |
| `Release-Notes.md` | User-visible changes only | Current through Release 0.1 — Features 018–021 and Milestones A/B/C1/C2 have no student-visible surface yet worth a release note; add entries if/when Release 0.2 is called done |
| `PROJECT_STATUS.md` | At-a-glance dashboard | Current |
| `ADR/` | Accepted architecture decisions | ADR-001, ADR-002, ADR-003, ADR-004, ADR-005. ADR-006/007 scoped (`Roadmap.md`), now writable since C1+C2 both shipped, but not yet written pending a request |
| `HANDOFF_PROMPT.md` | This file | Regenerated 2026-07-28 (Milestone C2 checkpoint) |
| `Wireframes.md` | Screen-level UI reference | Current through Release 0.1 — **not yet updated for TopicPage**, a real gap |
| `README.md` | Docs index | Stable |

---

## 11. Release 0.2 readiness

Features 018–021 delivered Release 0.2's Learn + Worked Examples stages for one chapter (Linear Equations) — this is real engineering progress, not just readiness-checking. What's still true from the original readiness assessment, and what's changed:

- **Schema**: `progressStore.ts`'s `schemaVersion` mechanism still hasn't needed a bump — Topic content is served from the backend, not stored in progress state. No change needed here.
- **Service boundaries / navigation / folder organization**: validated in practice, not just in theory — `ChapterPage` was in fact the natural insertion point for the Learn step, exactly as predicted.
- **What's left for Release 0.2 to be "complete," not just started**: export Data Handling (content is ready); the Understand stage (comprehension check) isn't built for any chapter yet; Practical Geometry, Understanding Quadrilaterals, and Rational Numbers haven't been through the pipeline at all — Rational Numbers has only a hand-seeded placeholder Topic.
- **Not yet decided**: whether Release 0.2 ships chapter-by-chapter as each is migrated, or waits for all five. Raise this with the user before assuming either.

Do not begin further Release 0.2 engineering (or a next milestone) without a fresh design/review/approval pass, per §5.

---

## 11.6. Scalable Assessment System — post-C2 readiness

Milestones A (identity, ADR-004), B (attempt history, ADR-005), C1 (planning layer), and C2 (stateful runtime) are all implemented — the full Learning Session Engine is done, backend-only. The milestones after them (E, F) are **not** implemented — don't treat the `Roadmap.md` sequencing as a green light to keep building down the list without a design pass each time.

- **What's left, none of it blocking the others**: write ADR-006/ADR-007 (both scoped, both now writable); design and build a frontend for `/sessions/*` (no UI exists for any of the four routes yet — this is real, not-yet-scoped work, not an oversight); Milestone E (Assessment Engine, teacher-facing) and Milestone F (UI/UX redesign) both still need their own implementation-ready design pass before code, the same way every milestone so far has gone through.
- **What Milestone C2 deliberately left undone, on purpose, not as an oversight**: no scheduler/cron for session lifecycle — `expired`/`abandoned` are checked lazily on access only, never proactively. `hintsUsedTotal` is reserved but always 0 — no hint-usage reporting mechanism exists anywhere in the codebase yet, including the pre-existing standalone `/answer` endpoint. The `degradationPolicy`/`substituted` refinement accepted during C2's design review was **not** implemented — it wasn't in this milestone's explicit step list; flagged as natural Milestone E scope. `submit_answer` advances the session on `SHOW_SOLUTION` as well as `NEXT_QUESTION` — a deliberate, documented deviation, since no separate "acknowledge and move on" endpoint exists in the approved API surface.
- **What Milestone C1 deliberately left undone, on purpose, not as an oversight**: `questionTypes` filtering is a documented no-op (`QuestionCandidate.type` is always `None` until P2 adds a type field to `Question`). Tier-backfill applies uniformly even to an explicitly single-tier request — flagged in `constraint_resolver.py`'s docstring as something Test mode specifically might want to override. Neither blocks anything today.
- **What Milestone B deliberately left undone, still true**: `attempts.session_id`/`session_mode` columns exist and are now populated by C2's `runtime_session_manager._record_attempt()` for session-originated attempts; standalone `/answer` submissions (outside a session) still leave them `NULL`. `misconception_tag` is still unpopulated (no misconception data in the runtime `Question` schema yet). No frontend consumes `GET /performance/me` yet.
- **What Milestone A left undone, still true**: no "list my classes" endpoint for a teacher managing more than one class; no password-reset or login rate-limiting.
- Read [ADR-004](ADR/ADR-004-student-teacher-identity.md) and [ADR-005](ADR/ADR-005-server-side-attempt-history.md) in full, plus `Development-Journal.md`'s 2026-07-28 (Milestone C1 and Milestone C2) entries, before touching `auth_service.py`, `attempt_service.py`, any of the Learning Session Engine's service modules, `routes/{auth,answers,performance,sessions}.py`, or the session middleware in `main.py`. Specifically re-read ADR-005's Decision section on `BackgroundTasks` ordering before adding a third background task to the `/answer` route, and `runtime_session_manager.py`'s module docstring before changing lifecycle or concurrency behavior.

---

## 12. Immediate next steps for a new session

1. Run `git status` and `git log --oneline -6` yourself — §6 may be stale by the time you read it.
2. Re-run backend `pytest` and frontend `vitest run` to confirm 198/198 and 49/49 still hold.
3. Ask the user what they want to work on — do not assume ADR-006/007, a Learning Session Engine frontend, or further Release 0.2 engineering is approved to start just because it's the named "next" theme. Per §6, confirm whether the priority is committing this checkpoint, writing the ADRs, a frontend design pass, P1's UX fixes, exporting Data Handling, operating Shadow Mode, or something else, before proceeding.
