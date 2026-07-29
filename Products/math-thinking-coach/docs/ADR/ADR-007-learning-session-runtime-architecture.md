# ADR-007: Learning Session Runtime Architecture (Milestone C2)

**Status:** Accepted
**Date:** 2026-07-28

---

## Context

ADR-006 established a stateless pipeline that turns an `AssessmentRequest` into a `SelectionOutcome` — but a `SelectionOutcome` is an in-memory value that vanishes the moment the function call returns. Nothing persisted it, nothing served it to a student one question at a time, and nothing stopped a client from being handed the complete question list up front — the exact thing this project's Scalable Assessment System named as a requirement to close ("never expose the complete question bank"). ADR-006's own design review had already split the original Question Selection Engine along this precise line: which half needs a persistence decision. This ADR is that half.

Its own design process mirrored ADR-006's rigor: a blueprint round, a critical review of six specifically named questions, and a final consolidation pass — all before any code was written.

## Problem Statement

Given a planned `SelectionOutcome`, how do you:

- Persist a session exactly once, without a second write path ever being able to create a duplicate
- Serve one question at a time, so the same code path handles question 1 and question 10 identically
- Let a student resume — refresh, close and reopen a tab, revisit later — without any special "resume" code path of its own
- Detect a stale submission (a second tab, a race) without a generic version field
- Retire a session that's timed out or gone inactive, without introducing a scheduler
- Keep the plan and the selected questions structurally immutable after creation, so no later code path — including this one — can ever rewrite what was originally selected

## Decision

SQLite persistence (`runtime.db` — `attempts.db` renamed in this same change, since the file now holds both the pre-existing `attempts` table from ADR-005 and this milestone's new `sessions` table), a single-writer Session Builder for creation, a single-writer Runtime Session Manager for every state change thereafter, a position-echo concurrency guard in place of a generic optimistic-concurrency version field, server-derived attempt numbers, and lifecycle transitions checked lazily on access with no scheduler.

## Architecture

```
POST /sessions ──────────────────────────────────────────────┐
                                                                ▼
                                          session_planning_pipeline.plan_session()   (ADR-006, unchanged)
                                                                │
                                                                ▼
                                          session_builder.create_session()
                                                    │  sessionId = plan.planId (no second UUID)
                                                    ▼
                                          session_store.insert_session()  ──→  runtime.db (sessions table)


GET  /sessions/{id}/current-question  ─┐
POST /sessions/{id}/answer            ─┼──→  runtime_session_manager  ──→  session_store.get_session /
GET  /sessions/{id}                   ─┘        │                          update_session_state()
                                                  │
                                                  ├──→ content_repository.get_question_content()  (full content,
                                                  │      one question at a time — never question_service directly)
                                                  ├──→ answer_service.evaluate_answer()  (unchanged, ADR-001)
                                                  └──→ attempt_service.record_attempt()  (best-effort, session_id
                                                         and session_mode now populated)
```

**Persistence (`session_store.py`).** One `sessions` table, one module-level `threading.Lock()` around every read and write — the same locking pattern `attempt_service.py`/`auth_service.py` already established, not a new one. `SessionPlan`'s nested data (`difficultyDistribution`, `questionTypes`, `weakConceptTopicIds`) and `selectedQuestions` are stored as two JSON columns (`plan_extra_json`, `selected_questions_json`) rather than a normalized schema, because both are always read and written as one whole, immutable unit and never queried by their internal fields — a decision recorded directly in the module's own comment, revisit only if a real cross-session query need appears. `update_session_state()`'s `UPDATE` statement names only `SessionState`-mapped columns in its `SET` clause — it is structurally incapable of touching `plan_extra_json` or `selected_questions_json`, not merely disciplined about avoiding them. An index on `student_id` (`idx_sessions_student`) exists in the schema today, ahead of any query that uses it — the one piece of this table built slightly ahead of an immediate need, since a per-student lookup was a foreseeable direction even though nothing calls it yet (see ADR-006's sibling document, the RR1 Release Plan, for the evidence-gated decision not to build that query surface for v1.0).

**Creation (`session_builder.py`).** `create_session()` is the only `INSERT` this table ever receives — runs ADR-006's unchanged `plan_session()` pipeline, then persists exactly once. `sessionId` adopts `plan.planId` directly rather than minting a second UUID for the same thing. A zero-question outcome (`actualCount == 0`) refuses creation entirely via `SessionCreationError` — a session with nothing to serve is meaningless. A partial shortfall still creates a session; the student gets what's actually available, honestly reported via the same `actualCount`/`shortfall` the client already has to handle from ADR-006. Unlike Shadow Mode (ADR-002) or attempt recording (ADR-005), a genuine persistence failure here is allowed to raise — session creation has no pre-existing response to protect, so silently swallowing a failure would hide the one thing the request actually asked for.

**Content access, two-tier (completing ADR-006's split).** `get_candidates()` (lean, pool-wide, selection-time — ADR-006, unchanged) and the new `get_question_content()` (one question, full display content, serving-time — this milestone's addition, reusing the existing `Question` model unchanged). Runtime Session Manager depends only on the latter, and never imports `question_service` directly — Content Repository stays the single content-access abstraction for both halves of the engine.

**Runtime (`runtime_session_manager.py`).** Two entry points. `get_current_question()` is a pure read — its only possible state change is a lazy lifecycle transition, applied before responding, and it is safe to call any number of times (this is the entirety of what "resume" means at the server level: there is no separate resume code path). `submit_answer()` is the only write path: evaluate (via `answer_service.evaluate_answer`, ADR-001's seam, completely unchanged) → record the attempt (best-effort, same failure tier as ADR-005's own attempt recording) → advance state, in that order, with the actual state mutation serialized through `session_store`'s lock. The attempt number is never accepted from the caller — always `SessionState.attemptsOnCurrentQuestion + 1`, closing the race a client-supplied `attemptNumber` would leave open across two tabs holding a stale count. A session advances past a question on `NEXT_QUESTION` **or** `SHOW_SOLUTION` — a deliberate, named deviation from today's frontend, which requires one additional manual "Mark Complete" click after a solution reveal; no equivalent "acknowledge and move on" endpoint exists in this milestone's approved API surface, so the session advances immediately instead.

**Concurrency guard.** The client echoes `position` on every `POST /answer`; a mismatch against `SessionState.currentPosition` is rejected with `409` before any evaluation happens. This catches the common case — a stale second tab, or a client retry after a response was lost — without a generic version field, and it doubles as the natural signal for "this question was already answered elsewhere."

**Lifecycle**, checked lazily on every access, no scheduler: `not_started → in_progress → {completed | expired | abandoned}`. `expired` (Test mode only — requires both `timeLimitMinutes` and a recorded `startedAt`) is checked before `abandoned` (inactivity past `SESSION_INACTIVITY_HOURS = 4`), so a timed-out test reads as `expired` even if it has also gone stale by the inactivity measure. Nothing sweeps sessions proactively — a session that's timed out or gone inactive simply reports its real status the next time anything touches it, and not before.

**Ownership.** Loading a session that doesn't exist and loading one that belongs to a different student return the identical `404` — deliberately not distinguished, so a session ID can't be probed to confirm another student's session is real.

**API surface** — four routes, all session-gated (`401` without a student session): `POST /sessions`, `GET /sessions/{id}/current-question`, `POST /sessions/{id}/answer`, `GET /sessions/{id}`. Position is 0-indexed throughout, deliberately — display formatting is a frontend concern, out of scope here.

## Alternatives Considered

- **Concurrency control: a generic optimistic-concurrency version field vs. the position-echo check.** Chose the position echo — position is the one value that actually needs to stay in sync for correctness, and reusing it (rather than adding a second field solely for concurrency) means the same mechanism naturally also flags "this question was already answered."
- **Lifecycle sweeping: a scheduler/cron job vs. lazy checks on access.** Chose lazy — explicitly declined to introduce new infrastructure (a scheduler) for a system that has never needed one. A session that nobody ever revisits simply never transitions, which was judged an acceptable cost against not building a background job.
- **Advancing on `SHOW_SOLUTION` vs. requiring a separate acknowledge step.** Chose immediate advance, since no "acknowledge and move on" endpoint exists in this milestone's approved surface — building one to preserve today's frontend's extra click was judged out of scope for this milestone, not because the deviation is unimportant. Flagged explicitly, not silently decided.
- **Persisting `SessionPlan`/`selectedQuestions` normalized vs. as JSON blob columns.** Chose JSON blobs, since neither is ever queried by an internal field — normalizing them would have added schema surface with no corresponding read need.
- **The `degradationPolicy`/`substituted` refinement accepted during this milestone's own design review.** Considered and accepted at the design level, then deliberately not implemented — it was outside this milestone's explicit step list. This is a real, named alternative that was chosen against for scope reasons, not an oversight; it is Milestone E's to pick up.

## Trade-offs

**Pros**
- Zero new dependency — `sqlite3` is stdlib, reusing exactly the pattern ADR-005 already established.
- Closes the one gap this milestone existed to close: question 1 and question 10 are now served by the identical code path, and the full question bank is never returned to a client.
- All four new test files (`test_session_store.py`, `test_session_builder.py`, `test_runtime_session_manager.py` — 24 tests, `test_sessions_api.py` — 11 tests, including a full 5-question walkthrough of real `rational-numbers` content through the actual API) passed on their first run — direct evidence the two extra design-review rounds (critical review, final consolidation) caught what needed catching before code.
- Live-verified via a real `curl` walkthrough against a running server, not just the test suite: session creation, a wrong answer staying in place, a correct answer advancing, `GET /performance/me` reflecting the result, a simulated stale second-tab resubmission returning the expected `409`, and an unknown session returning `404`.

**Cons**
- No proactive cleanup — an abandoned session sits in `in_progress` indefinitely until something happens to touch it again. Accepted, not treated as a defect.
- `hintsUsedTotal` is reserved as a schema field but always `0` — no hint-usage reporting mechanism exists anywhere in this codebase yet, including the pre-existing standalone `/answer` route.
- The `degradationPolicy`/`substituted` refinement accepted in this milestone's own design review was not implemented, per the scope decision above.
- The position-echo guard is checked once, at the start of `submit_answer`, before the lock-protected write happens later in the same function — two genuinely simultaneous requests at the same starting position could both pass that check before either has written. This narrow race was surfaced during the subsequent UX review (not during C2's own design review), and is named here as accurately-described shipped behavior, not something this ADR is redesigning. In this project's actual deployment shape (single process, SQLite, classroom/household scale) it has not been observed and is judged unlikely to matter in practice; it remains an honest, documented limitation rather than a silently assumed-safe one.
- SQLite inherits ADR-005's already-named limitation: single-file, single-machine, fine at this project's current scale, not designed for multi-server deployment.

## Consequences

- `attempts.session_id`/`attempts.session_mode` (columns ADR-005 reserved but left `NULL`) are now populated for every session-originated attempt, via `runtime_session_manager._record_attempt()`. Standalone `/answer` submissions outside a session continue to leave them `NULL` — this is now a permanent, structural split in the `attempts` table (session-backed vs. standalone rows), not a transitional state expected to close.
- `runtime.db` is the first file in this project ever renamed for a schema reason (`attempts.db → runtime.db`); it establishes that stateful runtime data shares one file per concern-cluster (attempts + sessions today) rather than one file per feature — a precedent for whatever the next stateful addition to this system turns out to be.
- Because `get_current_question`/`get_session_summary` are pure, repeatable reads with lazy lifecycle evaluation, "resume" required no dedicated implementation of its own — any future client can resume simply by calling the same read endpoint it would call anyway.
- Content Repository is now unambiguously the sole content-access abstraction for the entire Learning Session Engine (both ADR-006 and this ADR) — Runtime Session Manager's inability to import `question_service` directly is enforced by this milestone's own module boundaries, mirroring ADR-006's AST-enforced planner boundary in spirit, though not via the same executable test.

## Future Evolution

Only what this milestone's own implementation record already named, not new proposals:

- **`degradationPolicy`/`substituted`** — accepted in this milestone's design review, explicitly not implemented, flagged as natural Milestone E scope.
- **No scheduler for lifecycle sweeping** — named as an accepted limitation, not currently scheduled to change; would require an actual infrastructure decision if it ever does.
- **`hintsUsedTotal`** — reserved, unpopulated; would need a hint-usage reporting mechanism this codebase does not have anywhere yet.
- Two additional possibilities were raised only during the subsequent, separate UX review (not this milestone's own design review) and are recorded here strictly as evidence-gated, not committed: a student-scoped "list active sessions" read endpoint (would use the `idx_sessions_student` index already present in the schema) and exposing `timeLimitMinutes` on a read response for Test-mode countdown reconstruction after a reload. Neither is part of this milestone's decision; both were explicitly declined for the current release in the RR1 Release Plan pending real evidence of need.

## Related ADRs

- [ADR-001](ADR-001-evaluation-coaching-separation.md) — the evaluation/coaching seam `submit_answer` calls unchanged.
- [ADR-003](ADR-003-content-authoring-and-export-pipeline.md) — the approval gate `get_question_content` ultimately trusts, same as `get_candidates` does in ADR-006.
- [ADR-005](ADR-005-server-side-attempt-history.md) — the file (`runtime.db`, renamed here) and locking pattern this milestone reuses; the `session_id`/`session_mode` columns this milestone is the first to populate.
- [ADR-006](ADR-006-learning-session-planning-architecture.md) — the planning output this milestone persists and serves; nothing in `session_planning_pipeline.plan_session()` changed to accommodate this ADR.

## Implementation Impact

**Backend** — New: `app/services/{session_store, session_builder, runtime_session_manager}.py`, `app/api/routes/sessions.py`. Modified: `app/schemas/session.py` (`SessionState`, `LearningSession`, and the API-facing request/response shapes), `app/services/content_repository.py` (`get_question_content()` added), `app/services/attempt_service.py` (`DB_PATH` now points at `runtime.db`), `app/api/router.py` (sessions router mounted), `backend/.gitignore` (`runtime.db` in place of `attempts.db`).

**API** — Additive only: `POST /sessions`, `GET /sessions/{id}/current-question`, `POST /sessions/{id}/answer`, `GET /sessions/{id}`. No pre-existing endpoint's contract changed — the standalone `/answer` route (ADR-001/002/005) is untouched.

**Persistence** — `attempts.db` renamed to `runtime.db`; new `sessions` table added to that same file; the pre-existing `attempts` table is unmodified in shape, only newly populated in two previously-`NULL` columns for session-originated rows.

**Tests** — 198/198 backend passing (151 → 198, +47), split across persistence, builder, runtime-manager (24 tests), and API (11 tests) layers; all four new files passed on first run. Live-verified via `curl` against a running server with `SHADOW_MODE_ENABLED=false`, covering creation, a wrong-then-correct answer sequence, performance reflection, a simulated stale-tab `409`, and an unknown-session `404`.
