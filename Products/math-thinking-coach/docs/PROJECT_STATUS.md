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

✓ Local AI Evaluation Spike (Feature 014, experimental — see below)

---

## Current Feature

None in progress. Feature 014 (spike) reached a stable checkpoint. Production behavior is unaffected — the spike lives entirely in `backend/experiments/ai_evaluation/`, isolated from `app/*`.

---

## Next Feature

Not yet scoped.

(See docs/Backlog.md for candidates and a recommendation — Feature 015, Shadow Mode, is the recommended next step per the Feature 014 spike's results, but it still needs product-direction approval before implementation.)

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

Features 007–012 are committed (through commit `90e547b`). Feature 014's spike (new `backend/experiments/ai_evaluation/` — client, prompt, schema, dataset, harness, README, and a captured results run) and this documentation update are uncommitted as of this checkpoint. Run `git status` before starting new work.

---

## Last Verified

Backend ✔ (29/29 pytest, unchanged — Feature 014 touches nothing under `app/*`)

Frontend ✔ (untouched by Feature 014)

Tests ✔

Build ✔

Feature 014 (spike, not production) verified on its own terms: harness ran all 30 dataset samples against `qwen2.5:7b-instruct` via local Ollama — 100% valid JSON, 100% schema-valid, 93% correctness agreement with hand-labeled ground truth, mean latency 39.3s on CPU-only hardware. See `backend/experiments/ai_evaluation/README.md` for full results and limitations. No browser walkthrough applicable — no UI or API surface changed.
