# Development Journal

## 2026-07-28 (Milestone C2 — Learning Session Engine, Stateful Runtime)

*Follows four design-review passes on the runtime architecture (initial blueprint, critical review, final consolidation) that converged on an implementation-ready spec before any code was written. Implemented faithfully against that spec, step by step, each step compiling and passing the full suite before the next began — no architectural redesign during implementation, only the judgment calls the reviews explicitly deferred to implementation time.*

### Features completed
- `app/schemas/session.py` extended (not redesigned) with the C2 runtime aggregate: `SessionState`, `LearningSession`, and the API-facing `CreateSessionRequest/Response`, `CurrentQuestionResponse`, `QuestionContent`, `SessionTerminalResponse`, `SubmitSessionAnswerRequest/Response`, `SessionSummaryResponse`. C1's six existing types (`AssessmentRequest` through `SelectionOutcome`) are untouched except one additive constraint (see below).
- `app/services/session_store.py`: SQLite persistence for the `sessions` table, in the renamed `runtime.db` (was `attempts.db` — see ADR-005's own file, now shared). `insert_session` (Session Builder's only entry point) and `update_session_state` (Runtime Session Manager's only entry point, whose `UPDATE` statement structurally cannot name the immutable `plan_extra_json`/`selected_questions_json` columns — enforced by the function's own parameter list, not just caller discipline).
- `app/services/session_builder.py`: `create_session()` — runs C1's unchanged `session_planning_pipeline.plan_session()`, refuses to create a session with zero selectable questions, persists exactly once. `sessionId` is `plan.planId` adopted directly, not a second minted UUID.
- `app/services/content_repository.py` extended with `get_question_content(question_id) -> Question | None`, reusing the existing `Question` model unchanged. Runtime Session Manager never imports `question_service`.
- `app/services/runtime_session_manager.py`: `get_current_question()` (pure read) and `submit_answer()` (the only writer of `SessionState`), plus `get_session_summary()`. Lazy lifecycle transitions (`expired`/`abandoned`) applied on access, no scheduler. Server-derived attempt number (`SessionState.attemptsOnCurrentQuestion + 1`) — the request schema has no `attemptNumber` field at all.
- `app/api/routes/sessions.py`: `POST /sessions`, `GET /sessions/{id}/current-question`, `POST /sessions/{id}/answer`, `GET /sessions/{id}` — all session-gated (ADR-004) and ownership-checked (404, not 403, for a session that exists but isn't the requester's, so existence isn't confirmed to a guesser).

### Implementation-discovered decisions, not silently made
- **`submit_answer` advances on `NEXT_QUESTION` *or* `SHOW_SOLUTION`, not `NEXT_QUESTION` alone.** Discovered mid-implementation: today's `QuestionPage.tsx` has a second, client-only advancement trigger — a "Mark Question Complete" button click after the solution is revealed, with no server round-trip. The approved C2 API surface has no equivalent "acknowledge" endpoint (none was scoped), so an equivalent trigger was needed within `submit_answer` itself. Advancing immediately on `SHOW_SOLUTION` is a deliberate, named deviation from today's frontend, which pauses for a manual click; flagged here for product review if that reading pause needs to be preserved once this is user-facing, not decided unilaterally.
- **`SessionState.hintsUsedTotal` stays at 0 — a real, pre-existing gap, not a new one.** No mechanism anywhere in this codebase, including today's standalone `/answer` flow, reports hint usage back to the server (hint reveal is a purely client-side, non-API-calling interaction). The field is kept, matching this codebase's established pattern of reserving fields for known-future population (`attempts.question_type`, `attempts.misconception_tag`, `QuestionCandidate.type` all did the same before their consumers existed) — not dropped, not faked.
- **`AssessmentRequest.questionCount`/`timeLimitMinutes` gained `Field(gt=0)` constraints** — the one, explicitly-requested, additive touch to a C1 schema (the milestone brief's own Validation section named non-positive `timeLimitMinutes` as an example to reject). Backward compatible: `None` remains valid, every existing C1 test fixture already used positive values.
- **Degradation policy (`SessionPlan.degradationPolicy`, `SelectionOutcome.substituted`) was *not* implemented.** It was accepted in principle during the runtime-architecture review, but this milestone's own step list never included it, and implementing it would mean changing C1 schemas beyond what was explicitly asked. Left as a scoped, ready, deliberately-deferred follow-up — not forgotten, not silently dropped.
- **`attempts.db` → `runtime.db`**, renamed atomically in this same change, exactly as the review specified — the file now holds both `attempts` and `sessions`.

### Verification summary
- Backend: 198/198 pytest passing (151 → 198; +47 across `test_session_store.py`, `test_session_builder.py`, `test_runtime_session_manager.py` (24 tests — the bulk of new coverage, including expired/abandoned precedence, stale-position rejection, aggregate immutability, and attempt-history integration), `test_sessions_api.py` (11 route-level tests), plus 4 new tests in existing `test_content_repository.py`. Frontend unaffected (49/49), no frontend work in this milestone.
- Live, real server, `SHADOW_MODE_ENABLED=false`: teacher → class → student → create session → serve question 1 → wrong answer (position unchanged, recorded) → correct answer (advances, `GET /performance/me` correctly shows 2 attempted / 1 correct / streak 1) → simulated second-tab stale resubmission correctly rejected with `409` → unknown session correctly `404`. Every scenario the design review worried about, re-verified against a real running process, not just the test suite.
- `test_runtime_session_manager.py`'s 24 tests and `test_sessions_api.py`'s 11 tests all passed on the first run — the four design-review passes did their job; no implementation surprise required a design change.

### Implementation notes
- `evaluation_service.py`, `coaching_service.py`, `answer_service.py` (ADR-001), and C1's six components are untouched — confirmed by diff, not asserted. `answer_service.evaluate_answer` is called with just a question ID string, exactly as the standalone route already does; Runtime Session Manager never fetches content for evaluation, only for display.
- No ADR written. ADR-006 (planning/selection, C1) and ADR-007 (runtime, C2) remain scoped in `Roadmap.md`, to be written together now that both halves are implemented, tested, and verified — matching ADR-001 through ADR-005's discipline exactly.

## 2026-07-28 (Milestone C1 — Learning Session Engine, Stateless Planning Layer)

*Follows three design-review iterations (blueprint, refinement review, final domain-model validation) that together specified this milestone in full before any code was written. Implemented faithfully against that specification — no architectural redesign during implementation. No ADR written, per instruction: ADRs record shipped decisions, and this subsystem's ADR-006/007 pair is scoped but deliberately deferred until the stateful half (C2) also ships.*

### Features completed
- `app/schemas/session.py`: `AssessmentRequest`, `StudentLearningContext`, `SessionPlan`, `SelectionConstraints`, `QuestionCandidate`, `SelectedQuestion`, `SelectionOutcome` — the domain model validated across all three design reviews, implemented unchanged.
- `app/services/learning_context_service.py`: `build_learning_context()` — read-only, built fresh from `attempt_service.get_performance` (ADR-005) and a new `attempt_service.get_recent_question_ids()` read query. Safe for first-time students (`hasHistory=False`, every other field present but empty, never absent).
- `app/services/session_planner.py`: `create_plan()` — one component, three internal mode strategies (practice/test/revision), never imports content-access modules (enforced by a dedicated test that parses the module's own AST).
- `app/services/constraint_resolver.py`: `resolve_constraints()` — deterministic feasibility check and tier-backfill degradation (Medium → Easy → Hard priority), never selects an actual question.
- `app/services/content_repository.py`: `get_candidates()` — wraps `question_service` unchanged, documents the retrieval → normalization convention inline since only one source exists today.
- `app/services/question_selector.py`: `select()` — seeded deterministic shuffle per difficulty tier, Easy → Medium → Hard ordering, returns `SelectionOutcome` (never a bare list).
- `app/services/session_planning_pipeline.py`: `plan_session()` — thin composition of the five services above, explicitly documented as C1 scaffolding that C2's Session Builder will call, not a permanent sixth architectural component.

### Major engineering decisions materially affecting Milestone C2
- **Backfill applies uniformly, including to an explicitly single-tier request.** If a plan requests `difficulty="Hard"` and the chapter has zero Hard questions, Constraint Resolver backfills from Medium/Easy rather than returning a real shortfall — the same rule as a "Mixed" request, no special-casing by request shape. Discovered during implementation (a test's own expectation was wrong, not the code) — deliberately not changed to special-case single-tier requests, since that would add complexity for a distinction the accepted design never called for. Named explicitly because Test mode may want the opposite (a student who asked for Hard-only may not want an Easy question silently substituted) — the fix is isolated to `constraint_resolver._degrade()` if C2's design decides differently.
- **`questionTypes` filtering is a documented no-op today.** `QuestionCandidate.type` is always `None` — no question-type field exists on the runtime `Question` schema yet (P2, deferred pending Shadow Mode's confidence-calibration gap). `AssessmentRequest.questionTypes` and the resulting `SelectionConstraints.questionTypes` are accepted and threaded through for forward compatibility, but nothing filters on them yet. Not a bug — a named limitation to close when P2 adds the field.
- **`WEAK_ACCURACY_THRESHOLD = 0.6`** (in `learning_context_service.py`): a new, simple, explicitly-named heuristic for "weak topic" (attempted, not mastered, accuracy below 60%) — not derived from any prior design document, since none specified one. Flagged as a candidate for a real pedagogy review later, not a tuned value.
- **`get_recent_question_ids()`** added to `attempt_service.py` (ADR-005) — one new read-only query (`ORDER BY id DESC`, not `created_at`, to avoid timestamp-tie nondeterminism on fast sequential writes), no schema change, no new writer.
- **Default target count (10) and default Mixed-difficulty split (30/40/30, Medium absorbing the rounding remainder)** are new, simple, named constants in `session_planner.py` — not pulled from any existing spec, chosen for determinism and to roughly match the content pipeline's own documented difficulty balance.

### Verification summary
- Backend: 151/151 pytest passing (94 → 151; +57 across the seven new/extended modules). Frontend unaffected (49/49), no frontend files touched.
- Explicit edge-case coverage per the milestone's own requirements: insufficient supply (single-tier and total), degraded distributions (backfill math hand-verified against real Linear Equations/Rational Numbers content, not just synthetic fixtures), exclusion collisions (all candidates in a tier excluded), empty attempt history (first-time student, every context field safe), deterministic ordering (same seed → identical output; different seeds → can differ), `SelectionOutcome.shortfall` correctness (including a synthetic Selector-level shortfall distinct from a Resolver-level one, validating the wrapper's honesty in both cases).
- `session_planner.py`'s "never accesses content" invariant is enforced by a test, not just a docstring — it parses the module's own AST and asserts `content_repository`/`question_service` never appear in its imports.

### Implementation notes
- No API routes, no session persistence, no database writes beyond the one new read query — confirmed by `git status` on `app/api/` showing no changes, and by grep for `LearningSession`/`SessionState`/`CREATE TABLE` finding nothing beyond an explanatory docstring reference and the pre-existing, unmodified `attempts` table schema.
- `evaluation_service.py`, `coaching_service.py`, `answer_service.py`, `auth_service.py`, and every existing route are untouched.

## 2026-07-28 (Milestone B — Server-Side Attempt History)

*Followed a design review for the "scalable assessment system" milestone's P1-P4 (UX proposal, Assessment Engine, Question Selection Engine, Student Performance Model) that surfaced and resolved a real tension between the requested student-configurable "Test mode" (with visible marks) and `Product-Vision.md`'s Coaching vs. Assessment Philosophy — resolved as a distinct, opt-in, self-feedback-framed surface rather than a change to the default coaching experience. Milestone B (this entry) was identified as the actual prerequisite: P3's weak-concept/difficulty logic and P2's Test-mode summary both need real attempt data before they can do anything.*

### Features completed
- `app/services/attempt_service.py`: SQLite-backed (`backend/app/data/attempts.db`, gitignored) attempt log and deterministic per-topic aggregates. `record_attempt`/`record_attempt_for_answer` (the latter maps a `Question`/`AnswerSubmission`/`AnswerEvaluationResponse` triple into a row, wrapped in a try/except that logs and swallows — mirroring `shadow_evaluation_service.py`'s "never raise into the caller" discipline). `get_performance(student_id)` computes accuracy, current streak, and mastery (`LearningExperienceArchitecture.md`'s existing 3-consecutive-correct-no-hints rule) per topic, arithmetic only.
- `app/api/routes/answers.py`: dispatches `attempt_service.record_attempt_for_answer` via `BackgroundTasks`, only when `request.session.get("role") == "student"` (ADR-004). No session → no write, no error, response identical.
- `app/schemas/performance.py`, `app/api/routes/performance.py`: new `GET /performance/me`, session-gated (401 if not a student).

### Major engineering decisions
- Resolved ADR-004's deliberately-deferred persistence question: SQLite, not JSON files or a client/server database. `sqlite3` is stdlib — zero new dependency, no approval gate needed. Full reasoning in [ADR-005](ADR/ADR-005-server-side-attempt-history.md).
- Scoped tightly to attempt logging + read aggregates — explicitly not session orchestration (Practice/Test/Revision mode config, one-question-at-a-time serving), which stays deferred to the Assessment Engine's own future implementation pass, per this project's small-slices discipline. The `attempts` table has `session_id`/`session_mode`/`question_type`/`misconception_tag` columns reserved for that and for a future content-pipeline extension, but they're `NULL` today — reserved, not fabricated.
- **A real bug, caught by live verification, not by the test suite**: `answers.py` originally registered the attempt-recording background task *after* Shadow Mode's. Reading Starlette's `BackgroundTasks` source confirmed tasks run sequentially, `await`ed one at a time, not concurrently — so every attempt write was queuing behind Shadow Mode's AI evaluator call, measured in this environment at 40-90s (matching Feature 014's documented latency). Data was still recorded correctly, just delayed up to 90 seconds. Fixed by registering attempt recording first. This is exactly why the project's verification discipline requires a live walkthrough, not just green tests — the automated suite doesn't exercise real background-task timing under a slow, real Shadow Mode call, since `test_answers.py`'s fixture stubs the AI evaluator's network call to be instant.

### Verification summary
- Backend: 94/94 pytest passing (79 → 94; +15 across `test_attempt_service.py`, `test_performance.py`, and three new tests in `test_answers.py`). Adversarial test forces `attempt_service.record_attempt` to raise and confirms the response is unaffected, mirroring ADR-002's own convention.
- Live, both servers running: teacher register → create class; student join → answer a real question → `GET /performance/me` reflects it correctly. Re-verified after the ordering fix with Shadow Mode both enabled (no longer blocked) and disabled (instant) via `SHADOW_MODE_ENABLED=false`. Confirmed an anonymous submission is never recorded, and that the answer-evaluation response body is identical with or without a student session present.

### Implementation notes
- `evaluation_service.py`, `coaching_service.py`, `answer_service.py`, and the answer-evaluation response contract are untouched.
- Full detail, options considered, and named trade-offs (SQLite's single-file ceiling, no retroactive `localStorage` migration) in [ADR-005](ADR/ADR-005-server-side-attempt-history.md).

## 2026-07-28 (Milestone A — Student/Teacher Identity)

*First engineering slice of the "scalable assessment system" milestone, scoped down from the original request during design review: reading the Coaching-vs-Assessment tension in `Product-Vision.md` against the milestone's "Assessment Engine"/"teacher-ready assessments" language surfaced a real product-direction question that needed resolving before any code — confirmed as a teacher-facing surface only, student coaching experience unchanged. Auth was then identified as an invisible prerequisite for attempt history, adaptive selection, and teacher assessment generation alike, and pulled out as its own smaller milestone (Milestone A) rather than bundled into a much larger first slice.*

### Features completed
- Teacher accounts: `POST /auth/teacher/register` (email, bcrypt-hashed password, name), `POST /auth/teacher/login`, `POST /auth/teacher/classes` (session-gated, generates a 6-character join code).
- Student identity, no email/password collected: `POST /auth/student/join` (class code + display name + bcrypt-hashed 4+-digit PIN, unique display name per class), `POST /auth/student/login`.
- `POST /auth/logout`, `GET /auth/me`. Session via Starlette's `SessionMiddleware` (signed, HTTP-only cookie).
- `app/schemas/user.py` (Teacher, ClassGroup, Student, request/response schemas), `app/services/auth_service.py` (JSON-file stores under `backend/app/data/`, atomic tmp-then-rename writes, single lock, never-throws reads mirroring `progressStore.ts`'s philosophy).
- Frontend: `authService.ts` (all calls `credentials: 'include'`), `TeacherAuthPage.tsx` (login/register toggle, then create-class form showing the join code), `StudentJoinPage.tsx` (join/login toggle), both reachable from `HomePage` via two small new links. Neither page is wired to anything else yet — see Implementation notes.

### Major engineering decisions
- Students never provide an email or password — only a teacher-issued class code, a display name, and a short PIN. A deliberate minor-privacy decision, not just a UX one; see [ADR-004](ADR/ADR-004-student-teacher-identity.md).
- Account persistence stayed JSON-file-based (mirroring `chapters.json`/`topics.json`), deliberately deferring the real database decision to the next milestone (server-side attempt history), where actual volume will force it rather than this identity layer pre-deciding it.
- Existing content routes (`/chapters`, `/questions`, `/topics`, answer evaluation) were left completely open — auth only gates the new `/auth/*` routes. Confirmed by a dedicated regression test plus every pre-existing test passing unmodified.
- This milestone ships as dormant/additive: login/join work end-to-end, but nothing consumes identity yet — `progressService`/`progressStore` and the anonymous chapter/question flow are untouched, verified live with a session cookie present and absent.

### Verification summary
- Backend: 79/79 pytest passing (65 → 79; +14 for `test_auth.py`, including duplicate-email rejection, wrong-password/PIN rejection, session persistence across requests via `TestClient`'s cookie jar, and the existing-routes-unauthenticated regression check).
- Frontend: 49/49 vitest passing (40 → 49; +9 for `authService.test.ts`). `tsc -b`, `oxlint`, `vite build` all clean.
- Live, both servers running: teacher register → create class → join code shown; student join with that code → success; student re-login with correct PIN → success; wrong PIN → visible error, no session granted; the pre-existing anonymous Home → Select Chapter flow re-verified working identically throughout.
- One process note: a `get_page_text` read during the walkthrough appeared to show a stale, pre-transition render immediately after a successful join — a screenshot taken moments later confirmed the actual UI had updated correctly. Investigated via network-request inspection (the POST had already returned 200 with the correct body) before concluding it was a tooling timing artifact, not a real defect.

### Implementation notes
- `coaching_service.py`, `answer_service.py`, `evaluation_service.py`, and the answer-evaluation API contract are untouched by this milestone.
- New dependencies (`itsdangerous`, `bcrypt`) were named, justified, and approved before being installed, per `AI_Coding_Standards.md` §10 — neither was assumed or added silently.
- Full detail, options considered, and named trade-offs (PIN as a weak secret by adult standards, insecure dev session key, no password-reset or rate-limiting yet) in [ADR-004](ADR/ADR-004-student-teacher-identity.md).

## 2026-07-27 (Features 018–021 — Content Pipeline & Topic Delivery, Release 0.2 first slice)

*Ran in parallel with Feature 016/017 (Release 0.1) the same day — a separate, non-blocking track, per `Backlog.md`'s "Recommended Next" (content authoring doesn't depend on remaining engineering).*

### Features completed
- **Feature 018 — Topic data model & retrieval API.** `app/schemas/topic.py` (`Topic`: id, chapterId, title, explanation, workedExampleContent, learningObjectives), `app/services/topic_service.py` (`get_topics(chapterId)`, `get_topic(topicId)`, loaded once from `backend/app/data/topics.json`, same load-once-module-level pattern as `question_service.py`), `app/api/routes/topics.py` (`GET /api/v1/chapters/{chapterId}/topics` — 404 if chapter unknown, empty list if chapter has no topics; `GET /api/v1/topics/{topicId}` — 404 if unknown), mounted in `api/router.py`. `Question` gained `topicId: str | None = None` so a question can optionally belong to a Topic without breaking chapters that don't have one yet. Frontend: `TopicPage.tsx`/`.css` (explanation, worked example, learning objectives, "Start Practice" into the existing question flow), `types/topic.ts`, `questionService.getTopics`/`getTopic`, `App.tsx`'s new `/topic/:topicId` route, and `ChapterPage.tsx` now fetches topics alongside chapter/questions and shows a "Learn" button into the Topic when one exists (falling back to the existing "Start/Continue Learning" straight into questions when it doesn't).
- **Feature 019 — Template Engine v1.** `docs/content-pipeline/template-engine/`: a seeded procedural question generator. A template JSON describes a parametrized problem family; `generator.js` produces candidate parameter sets from a seeded RNG (`prng.js`); `validator.js` independently solves and constraint-checks each candidate (not templated-text substitution passed through unchecked); `duplicateDetector.js` dedupes against the existing bank and the current batch (exact-id, normalized-prompt-text); `canonicalFormatter.js` writes the canonical authoring shape; `batchExporter.js` writes the batch with generation metadata (template id/version, seed — always recorded, so a batch is reproducible). `run.js` is thin CLI glue (`node run.js --template=<path> --difficulty=<d> --count=<n> [--seed=<s>]`).
- **Feature 020 — Content authoring pipeline (stages 2–6).** `docs/content-source/<chapter>/`: stage2 (topic detection) → stage3 (concept extraction) → stage4 (learning objectives) → stage5 (worked examples) → stage6 (questions, hand-authored and/or Template-Engine-generated), plus a `canonical-topic.json` consolidating stages 2–5 into one candidate `Topic` record. Every exportable file carries `reviewStatus` (default `"ai-generated"`; only `"approved"` is export-eligible). Run for two chapters: **Linear Equations** (complete, approved, exported — see Feature 021) and **Data Handling** (complete through stage 6 — 42 questions, coverage-reviewed in `stage6-expansion-coverage-report.md` — but explicitly not yet approved/exported).
- **Feature 021 — Stage 10 Export Pipeline.** `docs/content-pipeline/export/`, invoked `node run.js --chapter=<slug> [--dry-run]`. Seven phases: load canonical content → approval gate (`reviewStatus === "approved"` only, question-level overrides file-level) → referential validation (chapterId/topicId resolve against `chapters.json` and, independently for topics vs. questions, against runtime `topics.json`) + duplicate detection → whitelist transform to the runtime shape → real Pydantic validation (shells out to `backend/.venv/Scripts/python.exe`, imports the actual `app.schemas.*` models — no JS reimplementation) → merge-by-chapter-partition atomic write (untouched chapters preserved byte-for-byte; write-to-`.tmp`-then-rename) → post-write re-validation from disk. Full detail and the options considered in [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md).

### Major engineering decisions
- A mid-build discovery, not anticipated in the original pipeline design: the first export attempt shipped 44 Linear Equations questions that all returned 500 on submission, because `evaluation_service` reads expected answers from the private `answer_keys.json` (ADR-001), never from `Question.solution`, and the export pipeline hadn't accounted for that second file. Fixed by adding an answer-keys co-requisite to phase [3] (an approved question cannot export without a matching, approved `answer_keys.json` entry) and authoring the 44 corresponding entries — documented with full honesty about the exact-match limitation this creates for free-text-style answers in `answer-keys.json`'s own note.
- Chose per-chapter-partition merge over whole-file overwrite specifically so a chapter with no canonical authoring trail at all (`rational-numbers`, hand-seeded before this pipeline existed) can never be silently wiped by an unrelated chapter's export run.
- Chose to shell out to the real backend Python venv for schema validation rather than reimplement the `Question`/`Topic` shape in JS — deliberately accepting the resulting hard coupling to a co-located `backend/.venv` (see ADR-003's Trade-offs) in exchange for zero risk of the pipeline's validation drifting out of sync with the actual Pydantic models.
- No automated test suite was written for `template-engine/` or `export/` themselves — correctness is enforced operationally by the pipeline's own runtime gates rather than by unit tests for the pipeline code. Named explicitly in ADR-003 as a real gap against this project's own testing convention, not treated as equivalent to test coverage.

### Verification summary
- Backend: 65/65 pytest passing (60 → 65; +5 for `test_topics.py`).
- Frontend: 40/40 vitest passing (36 → 40; +4). `tsc -b`, `oxlint`, `vite build` clean.
- Content: `stage6-expansion-coverage-report.md` — zero exact-duplicate `prompt`/`expectedAnswer` text across Linear Equations' 44 and Data Handling's 42 questions (automated check); every learning objective in both chapters has ≥2 questions; every question authored around exactly one target misconception.
- Live: `/topic/topic-linear-equations-one-variable` renders explanation, worked examples, and objectives; "Start Practice" proceeds into the existing, unmodified question flow; a Linear Equations question answer submission round-trips correctly post-fix (the answer-keys co-requisite fix above).

### Implementation notes
- `coaching_service.py`, `answer_service.py`, and the `POST /api/v1/questions/{questionId}/answer` contract are untouched by this work.
- Data Handling's 42 authored-and-reviewed questions are a ready, not-yet-shipped asset — one Stage 10 export run away from live, pending your review per `stage6-expansion-coverage-report.md`'s closing note.
- This is the first engineering delivered against `LearningExperienceArchitecture.md`'s Release 0.2 mapping (Learn + Worked Examples) — see `Roadmap.md` for the updated status.

## 2026-07-27 (Feature 016 — Progress Persistence Layer, Release 0.1)

### Features completed
- Implemented client-side progress persistence: `progressStore.ts` (localStorage read/write/clear, schema-versioned, corruption-safe — malformed or missing data always falls back to an empty default, never throws) and `progressService.ts` (the only interface any component uses — `getLastActiveChapter`, `setLastActiveChapter`, `getChapterProgress`, `getCompletedCount`, `recordQuestionAttempt`, `recordQuestionCompleted`, `updateCurrentQuestion`).
- Integrated into `QuestionPage`: resumes from the saved question index on load (clamped to a valid range), records an attempt on every answer submission (right or wrong), and records completion plus the new index when advancing — reusing the exact state transitions that already existed, with zero changes to evaluation, coaching, hint, or navigation logic.
- Added `src/types/progress.ts` (`QuestionStatus`, `ChapterProgress`, `StoredProgress`), following the existing one-file-per-domain convention.

### Major engineering decisions
- Store/Service split mirrors the backend's own pattern of a service function in front of a private data accessor (`evaluation_service.py`): `progressStore` is never imported outside `progressService.ts` — verified by grep, not assumed. Chosen specifically so a future backend-persistence swap (`Roadmap.md`'s medium-term "Student Progress History") can happen without changing any component.
- `recordQuestionAttempt` never downgrades a `'completed'` question back to `'attempted'` — completing always wins, an explicit business rule rather than an accident of write order.
- A real bug was caught during integration, not after: the "Chapter Complete! → Return to Chapters" button (shown only for the last question) called `navigate('/chapters')` directly, a separate code path from the handler used everywhere else for progress recording — meaning completing a chapter's final question would never have been recorded. Found by rereading the full file before testing rather than trusting the diff in isolation. Fixed by routing that button through the same handler, which simplified the code (one fewer inline function) as well as fixing the gap.
- Accepted, not fixed: `progressService`'s API is synchronous. A future backend-persistence swap will need it to become `Promise`-returning, a real migration cost for every caller — named explicitly rather than implied away.

### Verification summary
- 32/32 frontend tests passing (24 pre-existing + 8 new across `progressStore.test.ts` and `progressService.test.ts`); `tsc -b`, `oxlint`, `vite build` all clean.
- Backend re-run fresh, not assumed unaffected: 60/60 pytest, unchanged — zero backend files touched.
- Live browser walkthrough with both servers running: fresh visit → answer correctly → advance → hard page reload → resumed at the correct question, not reset to the first. Separately verified the last-question completion fix by jumping state to the final question and confirming both correct navigation and the previously-missing completion record.

### Implementation notes
- `answer_service.py`, `coaching_service.py`, and Shadow Mode are untouched — confirmed via diff, not just design intent. The only production files this feature touches are `QuestionPage.tsx` (for dispatch) and the two new service files.

## 2026-07-27 (Feature 017 — Chapter Overview & Continue Learning, Release 0.1)

### Features completed
- Repurposed the previously dead `/chapter/:chapterId` route: `ChapterPage.tsx` (unreachable from normal navigation before this feature, and still containing a literal `"(Placeholder)"` string) now renders a real Chapter Overview — chapter title, description, a completed-count summary, and a "Start Learning" / "Continue Learning" button (label conditional on whether any progress is recorded) that proceeds into the existing, unmodified question flow.
- `ChapterCard.tsx` now navigates to the Chapter Overview instead of straight into the question flow, and shows a lightweight "N completed" badge when a chapter has any recorded progress.
- `HomePage.tsx`'s "Continue Learning" button — previously present in the markup with no `onClick` handler at all — now navigates to the last-active chapter's Overview, or falls back to Chapter Selection if nothing has been recorded yet. One rule, no special cases.
- Added `progressService.getCompletedCount(chapterId)`, consolidating completed-question counting logic that had been duplicated identically in `ChapterCard.tsx` and `ChapterPage.tsx` — found during design review, fixed as a small, low-risk, in-scope cleanup rather than left to accumulate.

### Major engineering decisions
- Viewing the Chapter Overview marks that chapter as "last active," independent of whether any question has been attempted — a deliberate choice so simply browsing into a chapter, not just answering questions in it, makes Home's "Continue Learning" point there.
- The navigation chain is now uniform regardless of entry point: Chapter Selection and Home's "Continue Learning" both always land on the Chapter Overview first, which then proceeds into the question flow — one canonical entry point into a chapter, not two.
- `ChapterCard` reading `progressService` directly at render time, rather than receiving progress via props, was named explicitly as an accepted tradeoff, not an oversight: it turns a previously pure, prop-only component into one with a side-channel dependency on ambient state, acceptable at this scale (5 chapters) but worth remembering if this component is ever reused somewhere more state-sensitive.

### Verification summary
- 36/36 frontend tests passing (34 prior + 2 new for `getCompletedCount`); full suite re-run fresh rather than trusted from prior work. `tsc -b`, whole-project `oxlint` (not just touched files), `vite build` all clean.
- Backend pytest re-run fresh: 60/60, confirmed unaffected — this feature touches no backend file.
- Live verification of both required paths: an existing-progress profile (real accumulated data — "2 of 5 completed," "Continue Learning") and a freshly cleared profile (falls back correctly to Chapter Selection, no progress badges). A mobile-viewport check (375px) confirmed the new progress badge renders without overflow, consistent with this product's mobile-first principle.
- One process note, not a code defect: an early check of the existing-progress path appeared to fail ("Chapter not found") because it queried page state immediately after a click, before the async data fetch resolved — a race in the test's own timing, confirmed by rerunning with an explicit wait. Investigated rather than dismissed.

### Implementation notes
- Release 0.1 ("It Remembers You") is complete as of this feature — Feature 016 (persistence) and Feature 017 (the UI that makes it visible) together deliver the full scope approved in the Release 0.1 design. See `Roadmap.md` and `Backlog.md` for the release-level record, and `docs/ADR/` for the two architecture decisions (ADR-001, ADR-002) this release built on without modifying either.

## 2026-07-23 (Feature 015 — Shadow Mode AI Evaluation)

### Features completed
- Implemented Shadow Mode: the Feature 014 AI evaluator now runs against real answer submissions, out-of-band, alongside the production rule-based evaluator, with zero effect on the API response.
- Promoted the minimum of Feature 014's spike code into production-callable modules: `app/services/ai_evaluation_client.py`, `ai_evaluation_prompt.py`, `app/schemas/ai_evaluation.py`, `app/services/ai_evaluation_service.py` — each adding explicit timeout handling (90s default) and error classification (`timeout` / `connection_error` / `json_parse_failed` / `schema_invalid`) that the original spike didn't need. `backend/experiments/ai_evaluation/` itself is untouched and remains the offline harness.
- Added `app/services/shadow_log_writer.py` — thread-safe JSONL append to a gitignored path (`SHADOW_LOG_PATH`, default `app/data/shadow_log/shadow_eval_log.jsonl`).
- Added `app/services/shadow_evaluation_service.run_shadow_evaluation` — the out-of-band orchestrator: resolves the question, sources the canonical expected answer, calls the AI evaluator, computes agreement against the rule-based result, and logs one record. Wrapped in a broad exception handler so a failure here can never propagate into the request/response cycle.
- Wired the dispatch into `app/api/routes/answers.py` via FastAPI's `BackgroundTasks`, scheduled after the existing response is built — never blocking it, never altering it.
- Added `settings.shadow_mode_enabled` (env `SHADOW_MODE_ENABLED`, default `True`) as an operational kill switch guarding the dispatch.
- Refactored `evaluation_service.evaluate()` to call a new `get_expected_answer(question_id)` accessor internally instead of indexing the private `_answer_keys` dict directly, so both rule-based and AI evaluation source the canonical expected answer through one path.

### Major engineering decisions
- Chose in-process `BackgroundTasks` over an external task queue (Celery/RQ) — zero new infrastructure, and nothing in this codebase established an async-worker precedent to build on. Deliberately deferred, not rejected forever: revisit only if real traffic volume demands it.
- Chose JSONL over SQLite for the shadow log — no reporting UI or analytics exists yet, and the only consumer today is a human manually reviewing results, the same pattern Feature 014's harness already established.
- `answer_keys.json` sourcing was resolved as an explicit design decision, not left implicit: rejected both a second file reader (would duplicate the load Feature 012 already centralized in `evaluation_service.py`) and substituting `Question.solution` (would silently break comparability with Feature 014's dataset, which used the same short canonical answers, not the full-sentence solution text). Landed on one new accessor on `evaluation_service.py`, the module that already owns the private `_answer_keys` dict.
- The `shadow_mode_enabled` kill switch was not part of the original implementation pass — it was added after review explicitly raised that the route had no way to disable Shadow Mode short of a code change. Smallest possible fix: one new `Settings` field, one `if` around the existing dispatch call.
- The test suite required one deliberate addition beyond the original design: an `autouse` fixture in `test_answers.py` stubbing the AI evaluator's network call for every test in that file by default. Without it, the full suite's behavior would depend on whether a local Ollama server happened to be running on the machine executing the tests — non-deterministic at best, and up to several minutes slower at worst, since `BackgroundTasks` execute synchronously inside `TestClient` calls.

### Verification summary
- Backend: 60/60 pytest passing (47 immediately before this feature; +13 new tests across `test_evaluation_service.py`, `test_answers.py`, `test_ai_evaluation_client.py`, `test_ai_evaluation_prompt.py`, `test_ai_evaluation_schema.py`, `test_ai_evaluation_service.py`, `test_shadow_evaluation_service.py`, `test_shadow_log_writer.py`).
- The regression proof that matters most for this feature: every pre-existing exact-response-body assertion in `test_answers.py` (e.g. `test_correct_answer_returns_next_question`) passes completely unmodified, plus two adversarial tests that force the shadow path to fail (`RuntimeError`) and to be disabled (`shadow_mode_enabled=False`) and assert the response is unaffected either way.
- No frontend changes; no API contract changes.

### Implementation notes
- `coaching_service.py` and `answer_service.py` are untouched by this feature, confirmed via diff, not just design intent. The only production code this feature touches beyond its own new files is the route (`answers.py`, for dispatch) and `evaluation_service.py` (for the new accessor).
- Documented in [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md), which also records the expected-answer accessor decision as part of the same architectural record rather than a separate ADR, since it's a small decision made in direct service of Shadow Mode's invocation path.
- This feature makes Shadow Mode *operable* — it does not by itself constitute the larger-sample evidence Feature 014's README called for gathering. No meaningful data volume has been collected yet. See `Roadmap.md` and `Backlog.md` for what happens next.

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
