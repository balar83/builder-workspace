# Current Milestone

Milestone 2 – Coaching Engine

---

## Completed Features

✓ Frontend MVP

✓ Backend Foundation (Feature 007)

✓ Frontend Service Layer (Feature 008)

✓ Question Retrieval API (Feature 009)

✓ Answer Evaluation API — Rule-Based (Feature 010)

✓ Wire Coaching UI State (Feature 011)

✓ Separate Evaluation and Coaching Responsibilities (Feature 012)

---

## Current Feature

None in progress. Feature 012 reached a stable, verified checkpoint.

---

## Next Feature

Not yet scoped.

(See docs/Backlog.md for candidates and a recommendation — AI-based answer evaluation is the natural next step, with `evaluation_service.evaluate()` now the concrete extension point after Feature 012, but it still needs product-direction approval (model choice, prompt design) before implementation.)

---

## Architecture Snapshot

Frontend

React
TypeScript
Vite

Backend

FastAPI

Communication

REST API (`/api/v1`)

Current AI

Rule-Based (exact-match, trimmed)

Future AI

LLM

---

## Current Branch

main

---

## Uncommitted Work

Features 007–011 are committed (through commit `c762d59`). Feature 012's code (`backend/app/services/answer_service.py`, new `evaluation_service.py` and `coaching_service.py`, new `tests/test_evaluation_service.py` and `tests/test_coaching_service.py`) and this documentation update are uncommitted as of this checkpoint. Run `git status` before starting new work.

---

## Last Verified

Backend ✔ (29/29 pytest — original 20 unmodified plus 9 new unit tests for the extracted evaluation/coaching modules; `uvicorn` starts cleanly; live smoke test confirmed the `POST /api/v1/questions/{questionId}/answer` response is byte-identical to pre-refactor behavior)

Frontend ✔ (build + lint clean, 18/18 vitest — untouched by Feature 012)

Tests ✔

Build ✔

Manual browser walkthrough ✔ (chapter list, hints, solution reveal, full answer-evaluation flow incl. attempts 1/2/3, plus Feature 011: hint-suggested nudge on 2nd wrong attempt confirmed via DOM class, correct-answer "Next Question" button confirmed advancing state cleanly, manual hint-through-to-solution path regression-checked unchanged). Feature 012 is a backend-only internal refactor with no UI-observable change, verified via pytest and a live HTTP smoke test rather than a browser walkthrough.
