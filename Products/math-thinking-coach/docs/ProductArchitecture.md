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
- Tailwind CSS (to be added later)

## Backend

- FastAPI
- Python 3.13

## AI Layer

Initially:
- OpenAI / Claude API

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
                       │ REST API
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

The frontend never communicates directly with AI models.

All AI requests go through the backend.

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
│       │   │   ├── app/
│       │   │   ├── components/
│       │   │   ├── features/
│       │   │   │   ├── chapters/
│       │   │   │   ├── questions/
│       │   │   │   ├── hints/
│       │   │   │   ├── solutions/
│       │   │   │   └── history/
│       │   │   ├── services/
│       │   │   ├── hooks/
│       │   │   ├── types/
│       │   │   ├── utils/
│       │   │   └── assets/
│       │   └── tests/
│       │
│       ├── backend/
│       │   ├── app/
│       │   │   ├── api/
│       │   │   ├── services/
│       │   │   ├── ai/
│       │   │   ├── models/
│       │   │   ├── schemas/
│       │   │   ├── repositories/
│       │   │   └── main.py
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
Select Chapter
   │
   ▼
Select Topic
   │
   ▼
Ask Question
   │
   ▼
Thinking Mode
   │
 ┌─┴───────────────┐
 │                 │
 ▼                 ▼
Next Hint     Explain Again
 │
 ▼
Show Solution
 │
 ▼
Try Similar Question
 │
 ▼
History
```

---

# 7. API Endpoints

## Chapters

GET /api/v1/chapters

---

## Topics

GET /api/v1/chapters/{chapterId}/topics

---

## Submit Question

POST /api/v1/questions

Example Request

```json
{
  "chapterId": 1,
  "topicId": 3,
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

- AppLayout
- Header
- HomePage
- ChapterCard
- TopicCard
- QuestionInput
- HintCard
- HintStepper
- SolutionCard
- ProgressIndicator
- HistoryCard
- LoadingSpinner

---

# 9. MVP Scope

Included

- Chapter Selection
- Topic Selection
- Enter Question
- Progressive AI Hints
- Explain Hint
- Reveal Solution
- Question History

Not Included

- Login
- Parent Dashboard
- Teacher Dashboard
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