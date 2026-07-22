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

---

## Current Feature

None in progress. Feature 011 reached a stable, verified checkpoint.

---

## Next Feature

Not yet scoped.

(See docs/Backlog.md for candidates and a recommendation — AI-based answer evaluation is the natural next step but needs product-direction approval before implementation.)

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

Features 007–010 are committed (through commit `42371e0`), plus the handoff docs (`docs/Backlog.md`, `docs/PROJECT_STATUS.md`, `docs/HANDOFF_PROMPT.md`) from commit `3e0bb6b`. Feature 011's code (`frontend/src/pages/QuestionPage.tsx`, `QuestionPage.css`) and this documentation update are uncommitted as of this checkpoint. Run `git status` before starting new work.

---

## Last Verified

Backend ✔ (20/20 pytest, `uvicorn` starts cleanly — unchanged by Feature 011)

Frontend ✔ (build + lint clean, 18/18 vitest)

Tests ✔

Build ✔

Manual browser walkthrough ✔ (chapter list, hints, solution reveal, full answer-evaluation flow incl. attempts 1/2/3, plus Feature 011: hint-suggested nudge on 2nd wrong attempt confirmed via DOM class, correct-answer "Next Question" button confirmed advancing state cleanly, manual hint-through-to-solution path regression-checked unchanged)
