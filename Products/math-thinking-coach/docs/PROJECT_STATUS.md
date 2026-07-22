# Current Milestone

Milestone 2 – Coaching Engine

---

## Completed Features

✓ Frontend MVP

✓ Backend Foundation (Feature 007)

✓ Frontend Service Layer (Feature 008)

✓ Question Retrieval API (Feature 009)

✓ Answer Evaluation API — Rule-Based (Feature 010)

---

## Current Feature

None in progress. Feature 010 reached a stable, verified checkpoint.

---

## Next Feature

Feature 011

(To be decided — see docs/Backlog.md and HANDOFF_PROMPT.md for candidates and a recommendation)

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

Features 007–010 are all committed (through commit `42371e0`). Only handoff/status documentation (`docs/Backlog.md`, `docs/PROJECT_STATUS.md`, `docs/HANDOFF_PROMPT.md`) remains uncommitted as of this checkpoint. Run `git status` before starting new work.

---

## Last Verified

Backend ✔ (20/20 pytest, `uvicorn` starts cleanly)

Frontend ✔ (build + lint clean, 18/18 vitest)

Tests ✔

Build ✔

Manual browser walkthrough ✔ (chapter list, hints, solution reveal, full answer-evaluation flow incl. attempts 1/2/3)
