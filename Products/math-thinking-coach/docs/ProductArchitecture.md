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

Current: none in production. Answer evaluation is deterministic rule-based logic (`app/services/evaluation_service.py`).

Experimental, isolated from production (Feature 014 spike — see `backend/experiments/ai_evaluation/README.md` and [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md)):
- Local Ollama, `qwen2.5:7b-instruct`

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

The frontend does not communicate directly with AI models, and no AI model is in the production request path today. If AI-based evaluation is adopted, it enters through `evaluation_service`'s seam (see [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md)) — validated in isolation by the Feature 014 spike, not yet wired into this diagram.

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

# 6. Content Architecture

## Current model (actual, as implemented)

```
Chapter (id, title, description)
   └── Question (id, chapterId, question, text, difficulty, hints[], solution)
```

That's it — two levels. There is no Board, Class, Subject, or Topic entity anywhere in the data model or the code. "Class 8 CBSE Math" is not a data dimension the system reasons about; it's an implicit, hardcoded assumption baked into the content itself (`backend/app/data/chapters.json`/`questions.json`). `Topic` appears only as a **planned, not implemented** API (§7) — there is no `Topic` schema or data today.

There is likewise no "Quiz" construct — no timed or graded assessment session distinct from the linear, self-paced chapter → question flow described in §5. None has been requested. If one is ever needed, it should be designed against a real requirement, not spec'd speculatively here.

## Future extensibility (not decided — do not build against this)

A **Board → Class → Subject → Chapter → Topic → Question** hierarchy was raised as a candidate during the 2026-07-23 Product Foundation Sprint, as a way this could generalize beyond Class 8 CBSE Math. It is explicitly **not a commitment**: nothing today requires it, and building it now would be exactly the kind of speculative architecture `Product-Vision.md`'s "Extend on evidence, not speculation" principle warns against.

If a second class, subject, or board ever becomes an approved product requirement, that decision should get its own ADR before implementation — see `Roadmap.md`'s "Open architecture question" for the current state of this thinking, kept there so a future session doesn't have to rediscover it from scratch.

---

# 7. Backend API Endpoints

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

---

## Planned

### Topics

GET /api/v1/chapters/{chapterId}/topics

---

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

# 8. Core React Components

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

# 9. MVP Scope

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

# 10. Future Roadmap

Everything built to date (frontend MVP through the Feature 014 AI evaluation spike) is retroactively **Phase 1 — Core Coaching Loop**, now complete. Phases 2–5 below are unchanged in name and content from the original version of this document; see [`Roadmap.md`](Roadmap.md) for the authoritative, actively-maintained version — with dependencies, sequencing rationale, and near/medium-term items — so this table doesn't drift out of sync with it.

| Phase | Theme |
|---|---|
| 2 | Input Modalities — OCR Question Scanner, Voice Input/Explanation, Formula Revision |
| 3 | Oversight Surfaces — Parent Dashboard, Teacher Dashboard, Analytics |
| 4 | Adaptivity — Adaptive Learning, Personalized Practice, Weak Topic Detection |
| 5 | Distribution — Offline Mode, Multi-language, Play Store Release, Subscription Model |

---

# 11. Key Decisions (informal, pre-ADR)

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

# 12. Success Criteria

The MVP is successful if a Class 8 student can:

- Select a chapter
- Enter a question
- Receive guided hints
- Solve the problem independently
- Reveal the complete solution only when needed

The objective is to improve mathematical thinking rather than simply completing homework.