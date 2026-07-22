# Product Architecture
**Project:** Math Thinking Coach  
**Version:** 1.0  
**Status:** Approved  
**Author:** Builder Team

---

# 1. Vision

Build an AI-powered **Math Thinking Coach** for Class 8 CBSE students that helps them think through mathematical problems instead of immediately providing answers.

The objective is to improve conceptual understanding, confidence, and independent problem-solving.

---

# 2. Product Principles

1. Problems before technology.
2. Guide thinking instead of giving answers.
3. Keep the MVP simple.
4. Mobile-first experience.
5. AI should assist learning, not replace it.
6. Every feature must solve a real user problem.
7. Build for long-term scalability.

---

# 3. Technology Stack

## Frontend

- React
- TypeScript
- Vite
- React Router
- Local CSS styles

## Backend

- FastAPI (planned)
- Python 3.13

## AI Layer

Planned:
- OpenAI / Claude API through backend orchestration

Future:
- Gemini
- Azure OpenAI
- Ollama (Local Models)

## Version Control

- Git
- GitHub

---

# 4. High Level Architecture

```
                React Frontend
                       │
                       │ Planned REST API
                       ▼
                 FastAPI Backend
                       │
              Business Logic Layer
                       │
                AI Service Layer
                       │
        ┌──────────────┴──────────────┐
        │                             │
   Claude/OpenAI               Future AI Models
```

The frontend does not currently communicate directly with AI models.

AI integration is planned through the backend.

---

# 5. Folder Structure

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

# 6. Screen Flow

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

# 7. Backend API Endpoints

## Implemented

### Chapters

GET /api/v1/chapters

GET /api/v1/chapters/{chapterId}

### Questions

GET /api/v1/chapters/{chapterId}/questions

GET /api/v1/chapters/{chapterId}/questions/{questionId}

Chapter and question data is served from `backend/app/data/chapters.json` and `questions.json`, the single source of truth for both the API and (indirectly, via HTTP) the frontend.

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

## Phase 2

- OCR Question Scanner
- Voice Input
- Voice Explanation
- Formula Revision

## Phase 3

- Parent Dashboard
- Teacher Dashboard
- Analytics

## Phase 4

- Adaptive Learning
- Personalized Practice
- Weak Topic Detection

## Phase 5

- Offline Mode
- Multi-language
- Play Store Release
- Subscription Model

---

# 11. Architecture Decisions

| ID | Decision |
|----|----------|
| ADR-001 | React + TypeScript Frontend |
| ADR-002 | FastAPI Backend |
| ADR-003 | AI isolated behind Service Layer |
| ADR-004 | Mobile-first Responsive UI |
| ADR-005 | Feature-based Folder Structure |
| ADR-006 | Progressive Hinting instead of Direct Answers |

---

# 12. Success Criteria

The MVP is successful if a Class 8 student can:

- Select a chapter
- Enter a question
- Receive guided hints
- Solve the problem independently
- Reveal the complete solution only when needed

The objective is to improve mathematical thinking rather than simply completing homework.