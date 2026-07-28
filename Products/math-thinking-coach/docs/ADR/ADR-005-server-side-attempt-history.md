# ADR-005: Server-Side Attempt History (Milestone B)

**Status:** Accepted
**Date:** 2026-07-28

---

## Problem

Release 0.1's progress tracking is `localStorage`-only — anonymous, per-browser, no server-side record. `Roadmap.md`'s medium-term "Student Progress History" item, and the Scalable Assessment System design review's Milestone B, both named this as the actual prerequisite for anything adaptive: the Question Selection Engine (P3) needs real per-topic accuracy/streak/weak-concept data to select against, and the Assessment Engine's Test mode (P2) needs a real attempt count to summarize. ADR-004 deliberately left the persistence-technology question open rather than pre-deciding it. This ADR resolves it, with real data volume as the deciding factor for the first time in this project.

---

## Options Considered

**Persistence**
1. JSON files (`attempts.json`), mirroring ADR-003/ADR-004's existing pattern.
2. SQLite (`attempts.db`), Python's stdlib `sqlite3` — no new dependency.
3. A client/server database (Postgres, etc.) — real infrastructure.

**Execution model for the write**
1. Inline, synchronous, inside the request.
2. Out-of-band via FastAPI `BackgroundTasks`, reusing ADR-002's exact execution model.

**Scope of this milestone**
1. Attempt logging + read-side aggregates only.
2. Attempt logging plus full session orchestration (Practice/Test/Revision modes, one-question-at-a-time serving) for the Assessment Engine.

---

## Decision

**Persistence — Option 2 (SQLite).** JSON files fit low-write, small-volume data (accounts, content); attempt history is the opposite — one write per answer submission, with real querying needs (per-student, per-topic aggregates) that a full-file JSON rewrite per write doesn't scale to. ADR-002's own Trade-offs section already named the trigger for this move (*"If the JSONL log ever needs to be queried... that migration \[to SQLite] should be driven by an actual reporting requirement"*) — this is that requirement, materializing as predicted rather than being pre-built speculatively. `sqlite3` is stdlib: **zero new dependency**, no approval gate needed, still a single embedded file (`backend/app/data/attempts.db`, gitignored like the other runtime data stores), no new infrastructure. `app/services/attempt_service.py` uses plain hand-written SQL under a single `threading.Lock` (mirroring `shadow_log_writer.py`'s and `auth_service.py`'s locking pattern) — no ORM, consistent with this project's plain-function-module convention.

**Schema.** One `attempts` table: `student_id, question_id, chapter_id, topic_id, difficulty, question_type, session_id, session_mode, is_correct, attempt_number, hints_used, time_taken_seconds, misconception_tag, created_at`. `question_type`, `session_id`, `session_mode`, `time_taken_seconds`, and `misconception_tag` are present but always `NULL` today — no question-type field exists on `Question` yet (P2, not built), no session orchestration exists (P2, not built), and misconception tags exist only in `docs/content-source/` authoring data, not in the exported runtime `Question` schema. Columns are reserved, not fabricated data.

**Execution — Option 2 (`BackgroundTasks`), registered *before* Shadow Mode's task, not after.** `POST /questions/{id}/answer`'s existing response contract (ADR-001) is completely unchanged. A real bug was caught during this milestone's own live verification, not assumed away: `starlette.background.BackgroundTasks.__call__` runs its tasks in a `for` loop, `await`ed one at a time — confirmed by reading the source, not guessed. Registering attempt recording *after* Shadow Mode's dispatch meant every attempt write queued behind Shadow Mode's AI evaluator call, which this exact environment's local Ollama measures at 40-90s (matching Feature 014's documented mean latency) — attempts were still recorded correctly, just delayed by up to a minute and a half. Fixed by registering attempt recording first; verified live with Shadow Mode disabled (instant) and enabled (no longer blocked). Named here so a future addition to this route doesn't reintroduce the same ordering mistake.

**Recording is conditional, not universal.** `record_attempt_for_answer` only dispatches when `request.session.get("role") == "student"` (ADR-004's session). No session → no write, no error, response identical either way — Release 0.1's `localStorage` path keeps working unchanged for anonymous use, which remains a permanent, not transitional, mode of using the product. This is the first thing that makes ADR-004's identity layer stop being purely dormant.

**Scope — Option 1.** This milestone is attempt logging and read-side aggregates only. Session orchestration (mode config, one-question-at-a-time serving to satisfy "never expose the complete question bank") is explicitly deferred to the Assessment Engine's own implementation pass — kept separate per this project's small-slices discipline, even though the `attempts` table already has columns waiting for it.

**Read side.** One new endpoint, `GET /performance/me`, session-gated (401 if not a student). Aggregates are deterministic arithmetic over the raw log — no model: per-topic accuracy (`correct / attempted`), and mastery via `LearningExperienceArchitecture.md`'s already-approved rule (3 consecutive correct, no hints used, most-recent-first) — computed from real data for the first time, not newly invented.

---

## Trade-offs

**Pros**
- Real querying (per-student, per-topic) without a full-file rewrite per write — the actual reason JSON files were rejected here.
- Zero new infrastructure and zero new dependency, same posture as every prior ADR in this project.
- Attempt recording cannot affect the answer-evaluation response even if it fails — verified by an adversarial test forcing `record_attempt` to raise, mirroring ADR-002's own adversarial-test convention.
- The ordering bug this milestone caught and fixed is a real, generalizable lesson (background tasks are sequential, not concurrent) documented here so it isn't rediscovered.

**Cons**
- SQLite is still a single-file, single-machine store — fine for classroom-scale traffic, not designed for multi-server deployment. Not a problem today; no deployment story exists yet for this project to design against.
- No migration of existing `localStorage` progress into the new server-side history — there's no way to read a browser's local data server-side retroactively. A student's server-side history starts fresh from their first logged-in attempt. Named explicitly, not silently glossed over.
- `misconception_tag` and `question_type` columns exist but are unpopulated today — real values require, respectively, exporting misconception data into the runtime `Question` schema (a small ADR-003 pipeline extension, not scoped here) and P2's question-type field (not built). The schema anticipates them without building ahead of need.

---

## Future Evolution

If traffic ever outgrows a single SQLite file (multi-server deployment, real concurrent-write contention), that's a new decision deserving its own ADR, not a silent migration. Session orchestration for the Assessment Engine (P2) is the next consumer of the `session_id`/`session_mode` columns already reserved here. Exporting misconception tags into the runtime `Question` schema, when the Question Selection Engine (P3) actually needs them for its weak-concept boost, is a small, separate, evidence-gated addition to ADR-003's pipeline — not built now.

---

## Impact

**Backend** — New: `app/services/attempt_service.py`, `app/schemas/performance.py`, `app/api/routes/performance.py`, `backend/tests/{test_attempt_service,test_performance}.py`. Modified: `app/api/routes/answers.py` (background dispatch, reordered relative to Shadow Mode), `app/api/router.py` (mounts the performance router), `backend/.gitignore` (+`attempts.db`), `backend/tests/test_answers.py` (isolation fixture extended, 3 new tests).

**Frontend** — None. No page consumes `GET /performance/me` yet — that's the Assessment Engine's job.

**API** — Additive only: `GET /performance/me`. No existing endpoint's contract changed.

**Tests** — Backend 94/94 passing (79 → 94; +15). Live-verified: teacher register → create class; student join → answer a question → `GET /performance/me` reflects it correctly and quickly (both with Shadow Mode on and off); anonymous submission confirmed **not** recorded; the response contract confirmed byte-identical whether or not a student session exists.

---

## Related Documents

- [`ADR-002-shadow-mode-execution-and-logging.md`](ADR-002-shadow-mode-execution-and-logging.md) — the `BackgroundTasks` execution model this reuses, and the JSONL-to-SQLite migration trigger this ADR fulfills.
- [`ADR-004-student-teacher-identity.md`](ADR-004-student-teacher-identity.md) — the identity layer this milestone makes non-dormant for the first time.
- `Products/math-thinking-coach/docs/LearningExperienceArchitecture.md` — the mastery rule this ADR wires to real data rather than reinventing.
- `Products/math-thinking-coach/docs/Development-Journal.md` (2026-07-28 entry) — the implementation record, including the background-task ordering bug found during live verification.
