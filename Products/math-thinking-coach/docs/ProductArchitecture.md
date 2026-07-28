# Product Architecture
**Project:** Math Thinking Coach  
**Version:** 1.0  
**Status:** Approved  
**Author:** Builder Team

---

# 1. Vision & Principles

See [`Product-Vision.md`](Product-Vision.md) — the single source of truth for mission, target audience, long-term vision, product principles, coaching-vs-assessment philosophy, curriculum integrity, and extensibility principles. This file (`ProductArchitecture.md`) covers *how* the system is built; `Product-Vision.md` covers *why* it exists and what it optimizes for. Do not duplicate principles here — if it belongs in both, it's drifted.

---

# 2. Technology Stack

## Frontend

- React
- TypeScript
- Vite
- React Router
- Local CSS styles

## Backend

- FastAPI
- Python 3.13

## AI Layer

Current: rule-based logic (`app/services/evaluation_service.py`) is the only evaluator that drives coaching or the API response — unchanged since Feature 010.

Production, logging-only (Feature 015 — Shadow Mode, see [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md)):
- Local Ollama, `qwen2.5:7b-instruct`, called out-of-band via `BackgroundTasks` on every answer submission
- Never influences coaching or the API response; feature-flagged via `SHADOW_MODE_ENABLED` (default on)

Experimental, harness-only, not callable from `app/*` (Feature 014 spike — see `backend/experiments/ai_evaluation/README.md` and [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md)): the original 30-sample validation run that Feature 015 promoted code from.

Future, unvalidated:
- OpenAI / Claude API through backend orchestration
- Gemini
- Azure OpenAI

## Version Control

- Git
- GitHub

---

# 3. High Level Architecture

```
                React Frontend
                       │
                       │ REST API (/api/v1)
                       ▼
                 FastAPI Backend
                       │
        ┌──────────────┴──────────────┐
        │                             │
  evaluation_service            coaching_service
   (rule-based today)          (attempt-based logic)
```

The frontend does not communicate directly with AI models, and no AI model is in the *response* path above — that stays exactly rule-based. Since Feature 015 (Shadow Mode), an AI model does run in the production backend process, but out-of-band: dispatched via `BackgroundTasks` after the response shown above is already built, logging only, with no path back into it. See [ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md) for that execution model. If AI-based evaluation is ever adopted into coaching, it enters through `evaluation_service`'s seam (see [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md)) — a different, not-yet-taken path from this shadow one.

---

# 4. Folder Structure

```
BuilderWorkspace/
│
├── Products/
│   └── math-thinking-coach/
│       │
│       ├── frontend/
│       │   ├── src/
│       │   │   ├── assets/
│       │   │   ├── components/
│       │   │   ├── config/
│       │   │   ├── pages/
│       │   │   ├── services/
│       │   │   ├── types/
│       │   │   ├── App.tsx
│       │   │   ├── main.tsx
│       │   │   ├── index.css
│       │   │   └── App.css
│       │   ├── tests/
│       │   ├── package.json
│       │   └── vitest.config.ts
│       │
│       ├── backend/
│       │   ├── app/
│       │   │   ├── api/
│       │   │   ├── core/
│       │   │   ├── data/
│       │   │   ├── main.py
│       │   │   ├── models/
│       │   │   ├── schemas/
│       │   │   └── services/
│       │   └── tests/
│       │
│       ├── docs/
│       ├── prompts/
│       └── README.md
│
├── Playbook/
├── Learning/
├── Templates/
└── Experiments/
```

---

# 5. Screen Flow

```
Home
   │
   ▼
Chapter Selection
   │
   ▼
Chapter Detail
   │
   ▼
Question Page
   │
   ▼
Hint Guidance
   │
   ▼
Solution Reveal
   │
   ▼
Next Question / Chapter Complete
```

---

# 6. Progress Persistence

Client-side only — no backend involvement. Introduced in Release 0.1 ("It Remembers You" — Feature 016 + Feature 017; see `Development-Journal.md`'s 2026-07-27 entries).

```
QuestionPage / ChapterPage / ChapterCard / HomePage
                       │
                       ▼
                progressService.ts   ← the only interface any component uses
                       │
                       ▼
                 progressStore.ts    ← the only file that touches localStorage
                       │
                       ▼
                   localStorage
```

`progressStore.ts` owns raw read/write/clear against a single, schema-versioned localStorage key (`mtc.progress.v1`). Missing or corrupt data always falls back to an empty default — never throws.

`progressService.ts` is the only interface components use: `getLastActiveChapter`, `setLastActiveChapter`, `getChapterProgress`, `getCompletedCount`, `recordQuestionAttempt`, `recordQuestionCompleted`, `updateCurrentQuestion`. No component imports `progressStore` or touches `localStorage` directly — verified by grep, not assumed.

This mirrors the backend's own pattern — a service function in front of a private data accessor (see `evaluation_service.py`) — applied to the frontend for the first time.

**Deliberately not built**: any backend persistence. Progress lives entirely in the browser; there is no server-side record of it, no accounts, no multi-device sync. See `Roadmap.md`'s medium-term "Student Progress History" for when that changes.

**What this enables pedagogically** — resuming a chapter, seeing progress, and the deterministic Homework/Revision/Mastery logic these unlock — is described in [`LearningExperienceArchitecture.md`](LearningExperienceArchitecture.md), not repeated here.

---

# 7. Content Architecture

## Current model (actual, as implemented)

```
Chapter (id, title, description)
   ├── Topic (id, chapterId, title, explanation, workedExampleContent, learningObjectives[])   — optional, per chapter
   └── Question (id, chapterId, question, text, difficulty, hints[], solution, topicId?)
```

Three levels for chapters that have been migrated onto the content pipeline; two levels (Chapter → Question, no Topic) for chapters that haven't. As of Features 018–021 (2026-07-27): **Linear Equations** has a Topic and 44 questions, all tagged `topicId`. **Rational Numbers** has a Topic (hand-seeded before the pipeline existed, not pipeline output) and its original 5 questions, all tagged `topicId`. **Data Handling, Practical Geometry, Understanding Quadrilaterals** have no Topic and their original 5 questions each, `topicId: null`. `Question.topicId` is optional specifically so this partial-migration state is representable without a schema break.

There is still no Board, Class, or Subject entity anywhere in the data model or the code. "Class 8 CBSE Math" is not a data dimension the system reasons about; it's an implicit, hardcoded assumption baked into the content itself (`backend/app/data/chapters.json`/`questions.json`). See §14 for how new Topic/Question content is authored and gets here — it is no longer produced by hand-editing these JSON files directly, for any chapter that's been migrated onto the pipeline. Topic's pedagogical design (why it exists, what it carries) is written in [`LearningExperienceArchitecture.md`](LearningExperienceArchitecture.md) §3 — not repeated here; this section stays the technical record.

There is likewise no "Quiz" construct — no timed or graded assessment session distinct from the linear, self-paced chapter → question flow described in §5. None has been requested. If one is ever needed, it should be designed against a real requirement, not spec'd speculatively here.

## Future extensibility (not decided — do not build against this)

A **Board → Class → Subject → Chapter → Topic → Question** hierarchy was raised as a candidate during the 2026-07-23 Product Foundation Sprint, as a way this could generalize beyond Class 8 CBSE Math. It is explicitly **not a commitment**: nothing today requires it, and building it now would be exactly the kind of speculative architecture `Product-Vision.md`'s "Extend on evidence, not speculation" principle warns against.

If a second class, subject, or board ever becomes an approved product requirement, that decision should get its own ADR before implementation — see `Roadmap.md`'s "Open architecture question" for the current state of this thinking, kept there so a future session doesn't have to rediscover it from scratch.

---

# 8. Backend API Endpoints

## Implemented

### Chapters

GET /api/v1/chapters

GET /api/v1/chapters/{chapterId}

### Questions

GET /api/v1/chapters/{chapterId}/questions

GET /api/v1/chapters/{chapterId}/questions/{questionId}

Chapter and question data is served from `backend/app/data/chapters.json` and `questions.json`, the single source of truth for both the API and (indirectly, via HTTP) the frontend.

### Answer Evaluation (Rule-Based)

POST /api/v1/questions/{questionId}/answer

Request

```json
{
  "submission": {
    "answer": "36",
    "attemptNumber": 2
  }
}
```

Response

```json
{
  "evaluation": { "isCorrect": true, "score": 1.0 },
  "coach": { "message": "...", "nextAction": "NEXT_QUESTION" },
  "ui": { "canTryAgain": true, "canRevealSolution": false, "hintLevel": 0 }
}
```

Phase 1 evaluation is rule-based exact-match (trimmed) against a per-question expected answer stored in `backend/app/data/answer_keys.json`. This file is private to the backend and is never returned by the chapter/question endpoints above — it is the extension point for future AI-based evaluation, which would replace the exact-match comparison in `app/services/answer_service.py` without changing the API contract.

### Topics (Feature 018)

GET /api/v1/chapters/{chapterId}/topics → 404 if chapter unknown, `[]` if the chapter has no Topic yet

GET /api/v1/topics/{topicId} → 404 if unknown

Served from `backend/app/data/topics.json` via `app/services/topic_service.py`, same load-once-module-level pattern as `question_service.py`. See §7 for which chapters currently have a Topic and §14 for how one gets there.

### Identity (Milestone A)

POST /api/v1/auth/teacher/register, POST /api/v1/auth/teacher/login, POST /api/v1/auth/teacher/classes (session-gated), POST /api/v1/auth/student/join, POST /api/v1/auth/student/login, POST /api/v1/auth/logout, GET /api/v1/auth/me

Session-cookie based (see §15). Does not gate any endpoint above — every chapter/question/topic/answer route stays open with no session required.

### Attempt History (Milestone B)

GET /api/v1/performance/me → 401 if not a student session

Returns per-topic `{questionsAttempted, questionsCorrect, accuracy, currentStreak, mastered}`, computed from `backend/app/data/runtime.db`. See §16.

### Learning Session Runtime (Milestone C2)

POST /api/v1/sessions, GET /api/v1/sessions/{sessionId}/current-question, POST /api/v1/sessions/{sessionId}/answer, GET /api/v1/sessions/{sessionId} — all session-gated, 401 if not a student. See §18.

---

## Planned

## Submit Question

POST /api/v1/questions

Example Request

```json
{
  "chapterId": 1,
  "question": "Solve 2x + 5 = 17"
}
```

---

## Next Hint

POST /api/v1/questions/{questionId}/hint

---

## Explain Hint

POST /api/v1/questions/{questionId}/explain

---

## Show Solution

POST /api/v1/questions/{questionId}/solution

---

## Similar Question

POST /api/v1/questions/{questionId}/similar

---

## History

GET /api/v1/history

---

# 9. Core React Components

- App
- HomePage
- ChapterSelectionPage
- ChapterPage
- QuestionPage
- ChapterCard
- DifficultyBadge
- AnswerInput
- HintPanel
- QuestionProgress
- ProgressBar
- SolutionPanel

---

# 10. MVP Scope

Included

- Chapter selection
- Chapter detail and navigation
- Multi-question chapter flow
- Student answer entry before hints
- Progressive hint guidance
- Solution reveal after hints
- Question progress indicator

Not Included

- Topic selection
- Question history
- Login
- Parent dashboard
- Teacher dashboard
- OCR
- Voice
- Gamification
- Analytics

---

# 11. Future Roadmap

Everything built to date (frontend MVP through the Feature 014 AI evaluation spike) is retroactively **Phase 1 — Core Coaching Loop**, now complete. Phases 2–5 below are unchanged in name and content from the original version of this document; see [`Roadmap.md`](Roadmap.md) for the authoritative, actively-maintained version — with dependencies, sequencing rationale, and near/medium-term items — so this table doesn't drift out of sync with it.

| Phase | Theme |
|---|---|
| 2 | Input Modalities — OCR Question Scanner, Voice Input/Explanation, Formula Revision |
| 3 | Oversight Surfaces — Parent Dashboard, Teacher Dashboard, Analytics |
| 4 | Adaptivity — Adaptive Learning, Personalized Practice, Weak Topic Detection |
| 5 | Distribution — Offline Mode, Multi-language, Play Store Release, Subscription Model |

---

# 12. Key Decisions (informal, pre-ADR)

The table below predates this project's formal ADR process (established 2026-07-23) and was never written up as real Architecture Decision Records — no corresponding documents exist for any row. It's kept for historical continuity, relabeled so it's no longer mistaken for `docs/ADR/`. The first real ADR is [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md) (Evaluation/Coaching separation) — new formal ADRs continue numbering from there, independent of this table's IDs.

| ID | Decision |
|----|----------|
| KD-1 | React + TypeScript Frontend |
| KD-2 | FastAPI Backend |
| KD-3 | AI isolated behind Service Layer |
| KD-4 | Mobile-first Responsive UI |
| KD-5 | Feature-based Folder Structure |
| KD-6 | Progressive Hinting instead of Direct Answers |

---

# 13. Success Criteria

The MVP is successful if a Class 8 student can:

- Select a chapter
- Enter a question
- Receive guided hints
- Solve the problem independently
- Reveal the complete solution only when needed

The objective is to improve mathematical thinking rather than simply completing homework.

---

# 14. Content Authoring & Export Pipeline

Introduced in Features 018–021 (2026-07-27); full rationale and options considered in [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md) — this section stays the technical record.

```
docs/content-source/<chapter>/          Authoring trail: stage2 (topic detection) → stage3 (concept extraction)
                                          → stage4 (learning objectives) → stage5 (worked examples)
                                          → stage6 (questions), canonical-topic.json (consolidates stages 2–5)
                                          reviewStatus-gated: "ai-generated" (default) | "approved"
        │
        ▼  (node docs/content-pipeline/export/run.js --chapter=<slug>)
docs/content-pipeline/export/            Stage 10 Export — 7 phases: load → approval gate → referential +
                                          duplicate validation → whitelist transform → real Pydantic validation
                                          (shells out to backend/.venv) → merge-by-chapter-partition atomic
                                          write → post-write re-validation
        │
        ▼
backend/app/data/{topics,questions,answer_keys}.json     the single runtime source of truth (§7, §8)
```

`docs/content-pipeline/template-engine/` (Template Engine v1) is a separate, upstream tool that feeds stage 6: given a template describing a parametrized problem family, it generates, independently solves/verifies, and deduplicates candidate questions at volume, writing them in the same canonical authoring shape stage 6 expects.

Both `content-pipeline/` directories are build-time authoring tooling — plain Node.js, no npm dependency, never imported by `app/*` or `frontend/src/*`. They live under `docs/` rather than a new top-level folder, per `AI_Coding_Standards.md` §1's no-new-top-level-folders-without-approval rule (see ADR-003's Trade-offs for why that's an imperfect fit, worth revisiting).

**Not every chapter has been migrated onto this pipeline.** See §7 for the current per-chapter state.

---

# 15. Identity (Milestone A)

Introduced in Milestone A (2026-07-28), the first slice of the Scalable Assessment System (see `Roadmap.md`); full rationale and options considered in [ADR-004](ADR/ADR-004-student-teacher-identity.md) — this section stays the technical record.

```
Teacher (id, email, name, passwordHash)
   └── ClassGroup (id, teacherId, name, code)
          └── Student (id, classId, displayName, pinHash)
```

Students never provide an email or password — only a teacher-issued 6-character class code, a display name (unique per class, not globally), and a 4+-digit PIN. Both password and PIN are bcrypt-hashed; neither is ever returned by any endpoint's response model. Session state is an HTTP-only, signed cookie (Starlette `SessionMiddleware`, `itsdangerous`-backed) holding only `{role, id}` — never a name, email, or PIN.

Accounts persist in `backend/app/data/{teachers,classes,students}.json`, gitignored, read/written by `app/services/auth_service.py` under a single lock with atomic tmp-then-rename writes — the same pattern §14's export pipeline established for content. This was a deliberate, temporary choice: it deferred the real database decision to §16, where actual volume forced it, exactly as anticipated here.

**No longer dormant as of §16.** `/chapters`, `/questions`, `/topics`, and answer evaluation remain completely unauthenticated, unchanged. But a logged-in student session is now consumed — see §16.

---

# 16. Server-Side Attempt History (Milestone B)

Introduced in Milestone B (2026-07-28), resolving §15's deferred persistence decision; full rationale, options considered, and a real background-task ordering bug found during verification are in [ADR-005](ADR/ADR-005-server-side-attempt-history.md) — this section stays the technical record.

```
POST /questions/{id}/answer          (unchanged response contract, ADR-001)
        │
        ▼ (BackgroundTasks, registered before Shadow Mode's task — see ADR-005)
attempt_service.record_attempt_for_answer   only dispatched when request.session.get("role") == "student"
        │
        ▼
backend/app/data/runtime.db           SQLite (stdlib sqlite3, zero new dependency), attempts table
                                       (renamed from attempts.db in Milestone C2, which added a sessions
                                       table to the same file — see §18)
```

`GET /performance/me` (session-gated, 401 if not a student) reads back deterministic per-topic aggregates — accuracy, current streak, and mastery via `LearningExperienceArchitecture.md`'s existing rule (3 consecutive correct, no hints, most-recent-first). No model, arithmetic only.

Anonymous use is completely unaffected — no session means no write, no error, and Release 0.1's `localStorage` progress tracking (§6) remains the path for it, permanently, not just during a transition. No frontend page consumes `GET /performance/me` yet; that begins with the Assessment Engine (`Roadmap.md`'s Milestone E).

---

# 17. Learning Session Engine — Stateless Planning Layer (Milestone C1)

Introduced in Milestone C1 (2026-07-28), after three design-review iterations (blueprint, refinement review, final domain-model validation) elevated the originally-scoped Question Selection Engine into a full session-planning architecture, then split it along the one property that mattered — which half needs a persistence decision. This section covers only the stateless half; §18 covers the stateful half (Milestone C2), now also complete. No ADR yet for either half: ADR-006/007 are scoped and now writable, per this project's convention that ADRs record shipped decisions, but haven't been requested.

```
AssessmentRequest ──┐
                     ▼
  attempt_service ─→ StudentLearningContext ─→ SessionPlanner ─→ SessionPlan
                                                                       │
                             ┌─────────────────────────────────────────┘
                             ▼
  question_service ─→ ContentRepository ─→ QuestionCandidate[] ──┐
                                                                   ▼
                                              ConstraintResolver ─→ SelectionConstraints
                                                                        │
                                                                        ▼
                                              QuestionSelector ─→ SelectionOutcome
```

Six plain-function modules under `app/services/`, one per box above, composed by `session_planning_pipeline.plan_session()` — deliberately not a seventh architectural component, just the glue Milestone C2's Session Builder will call when it persists a real session. Every step is deterministic: `question_selector.py` uses `random.Random(seed)`, never wall-clock time; `constraint_resolver.py` degrades under-supplied difficulty tiers via a fixed backfill priority (Medium → Easy → Hard), documented in its own module docstring as applying uniformly even to an explicitly single-tier request — a decision made during implementation, not pinned down by any prior review, and flagged as something Milestone C2 (particularly Test mode) may want to revisit.

`SelectionOutcome` — never a bare list — is the domain-model finding from the final validation review: `SelectionConstraints.resolvedCount` reflects pool-level feasibility, but the Selector's own exclusion pass can still under-deliver relative to it, so the outcome always reports `actualCount`/`shortfall` honestly rather than leaving the caller to infer a possible mismatch.

**No API surface, no persistence.** This layer has no route, is never called from `app/api/*`, and writes nothing except through `attempt_service`'s pre-existing (ADR-005) `get_recent_question_ids` read query, added here as the one small extension to that module. `Question`'s `topicId`-optional shape (§7) and `Question` itself having no `type` field yet (P2, deferred) both flow through as-is — `QuestionCandidate.type` is always `None` today, a documented no-op, not a bug.

---

# 18. Learning Session Engine — Stateful Runtime (Milestone C2)

Introduced in Milestone C2 (2026-07-28), the stateful half of the architecture §17 introduced — its own three-round design review (blueprint, critical review of six named questions, final consolidation) before any code. This is what turns a `SelectionOutcome` into something a student can actually work through one question at a time, without ever exposing the full question bank to the client. No ADR yet — see §17's note.

```
POST /sessions ──────────────────────────────────────────────┐
                                                                ▼
                                          session_planning_pipeline.plan_session()   (§17, unchanged)
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

**Persistence.** `session_store.py` is the only module that touches the `sessions` table — one `threading.Lock()`, the same pattern `attempt_service.py`/`auth_service.py` already established. `attempts.db` was renamed to `runtime.db` in this change, since the file now holds both tables; `attempts` itself is untouched. Two columns (`plan_extra_json`, `selected_questions_json`) hold the plan's immutable nested data as JSON — `update_session_state()`'s `SET` clause only ever names `SessionState`-mapped columns, so it is structurally incapable of mutating the plan or the selected-question list, not just disciplined about it.

**Content access stays two-tier**, per §17's Content Repository: `get_candidates()` (lean, pool-wide, selection-time — unchanged) and the new `get_question_content()` (one question, full content, serving-time). Runtime Session Manager depends only on the latter — it never imports `question_service` directly, preserving Content Repository as the single content-access abstraction.

**Concurrency and trust boundary.** The client echoes back `position` on every `POST /answer`; the server rejects a mismatch with a 409 before evaluating anything — this catches a stale second tab without a generic optimistic-concurrency version field. The attempt number is always server-derived (`SessionState.attemptsOnCurrentQuestion + 1`), never taken from the request, closing the gap a naive client-supplied `attemptNumber` would have left open across tabs. The actual state write is serialized through `session_store`'s single `threading.Lock()`.

**Lifecycle**, checked lazily on every access, no scheduler: `not_started → in_progress → {completed | expired | abandoned}`. `expired` (Test mode only, requires `timeLimitMinutes` and a `startedAt`) is checked before `abandoned` (inactivity past `SESSION_INACTIVITY_HOURS`), so a timed-out test reads as expired even if it's also gone stale. A session advances past a question on `NEXT_QUESTION` *or* `SHOW_SOLUTION` — a deliberate extension beyond `QuestionPage.tsx`'s current manual "Mark Complete" click, since no equivalent acknowledge step exists in this API surface; documented here as a flagged deviation, not a silent one.

**Ownership.** Loading a session for the wrong student raises the identical error as loading one that doesn't exist at all (404 either way) — deliberately not distinguishing the two, so a prober can't use the response to confirm a session ID is valid.

**Deliberately not built in this milestone**: the `degradationPolicy`/`substituted` refinement accepted during design review but never in this milestone's explicit implementation scope — flagged for Milestone E. `hintsUsedTotal` is reserved but always 0 — no hint-usage reporting mechanism exists anywhere in this codebase yet. No frontend consumes any of these four routes.