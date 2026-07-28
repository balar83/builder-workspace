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