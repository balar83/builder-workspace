# Math Thinking Coach

An AI-assisted coaching product for Class 8 CBSE mathematics, evolving toward an **AI Learning Companion**. The core philosophy, unchanged since the project's earliest design decisions: **coach students to think through problems — don't just quiz them.** Practice and Revision modes never show a score, no matter how the student did; hints are progressive, never handing over the answer; content is sourced from real NCERT Class 8 material. Full detail: [`Product-Vision.md`](Product-Vision.md).

**Current release: 0.1.2**, live in production. This file is the docs index and current-state overview — for a comprehensive, standalone project handoff (written so a fresh AI session can continue with zero context loss), see **[`Phase-1-Handoff.md`](Phase-1-Handoff.md)**, the canonical handoff document (see "Documentation conventions" below).

---

## Architecture

**Stack:** React 19 + TypeScript + Vite (frontend) · Python 3.13 + FastAPI + Pydantic (backend) · `sqlite3` stdlib for session/attempt persistence · file-based JSON for content · REST/JSON under `/api/v1`.

**Deployment (split hosting, both auto-deploy on push to `main`):**

| | URL |
|---|---|
| Frontend | https://math-thinking-coach-zeta.vercel.app/ |
| Backend | https://math-thinking-coach-api.onrender.com |

Full deployment detail, including the two real production bugs found and fixed during Release 0.1.2 (a Vercel SPA-fallback gap and a rename-related domain-aliasing issue): [`Deployment-Guide.md`](Deployment-Guide.md).

---

## Current chapters

| Chapter | Questions | Has a Learn page |
|---|---|---|
| Linear Equations | 44 | ✅ |
| Data Handling | 42 | ✅ |
| Understanding Quadrilaterals | 40 | ✅ |
| A Square and A Cube | 40 | ✅ |
| Rational Numbers | 40 | ✅ |
| Practical Geometry | 35 | ❌ |

**241 questions across 6 chapters.** All six went through the same content model — authored offline, reviewed, and exported through the Stage 10 pipeline (see [`ADR-003`](ADR/ADR-003-content-authoring-and-export-pipeline.md)) — **except Practical Geometry**, which uses a dedicated topic-less export path (`docs/content-pipeline/export/run-topicless.js`) instead of the normal `run.js`, since the normal pipeline has no way to resolve a chapter's id for questions with no Topic to anchor them. That script reuses the pipeline's real approval-gate and transform/validate/merge logic, but not its structural loader — tracked architectural debt, not a second content pipeline. Understanding Quadrilaterals was authored entirely from scratch in Release 0.1.1 after the official NCERT source PDF turned out to be a non-text-extractable scan — documented honestly in that chapter's own authoring trail rather than fabricated as a literal extraction. A Square and A Cube matches NCERT's own current "Ganita Prakash" syllabus, which already merges Squares/Square Roots and Cubes/Cube Roots into one chapter.

---

## The Learning Session Engine

The stateful core of the authenticated experience: a student configures a session (chapter, mode, difficulty, question count), the engine plans a question set from real attempt history, persists it, and serves it one question at a time with server-derived state (no client-trusted attempt numbers). Two halves, both implemented and documented:

- **Planning** (stateless) — [`ADR-006`](ADR/ADR-006-learning-session-planning-architecture.md)
- **Runtime** (stateful, session persistence + answer submission) — [`ADR-007`](ADR/ADR-007-learning-session-runtime-architecture.md)

---

## Workflows

**Anonymous visitor:** browse all 6 chapters, read a Learn page where one exists (5 of 6 — Practical Geometry intentionally has none), work the full question bank per chapter with progressive hints and rule-based evaluation. Progress tracked in `localStorage` only — no login required, no server record kept.

**Student (authenticated):** join a class with a code + display name + 4-digit PIN (no email/password ever collected from students, by design). Dashboard shows real per-topic performance pulled from server-recorded history. Start a configured session (Practice / Revision / Test), work through it with server-persisted state, resume an abandoned session via a Dashboard banner, complete it (score shown only in Test mode).

**Teacher:** register/login (email + password), create a class, get a join code (shown once — there is currently no way to retrieve a lost code; see Known limitations). No roster or class-progress view yet.

---

## Development setup

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload   # http://localhost:8000

# Frontend
cd frontend
npm install --legacy-peer-deps  # required — React 19 vs. a peer's React 18 constraint
npm run dev                     # http://localhost:5173
```

Full setup, troubleshooting, and clean-clone validation notes: [`Developer-Runbook.md`](Developer-Runbook.md).

---

## Testing

| Suite | Status |
|---|---|
| Backend `pytest` | 205/205 |
| Frontend `vitest run` | 112/112 |
| Frontend `tsc -b` | clean |
| Frontend `oxlint` | clean |

No page-level automated tests exist anywhere in this codebase, by established convention — page behavior is verified via live browser walkthrough every time, not unit tests. Before calling any change done: run all four fresh, then a live walkthrough for anything UI-observable. Full strategy: `Phase-1-Handoff.md` §11.

---

## Release 0.1.2 highlights

- **Curriculum complete** — all five chapters authored/exported (see "Current chapters" above).
- **Frontend UX overhaul** — a real design-token system, a rebuilt Learn page, visible coaching feedback, one consistent navigation pattern (`BackLink`) on every screen, verified at 10 responsive breakpoints (320–1440px) with zero overflow.
- **Production-readiness audit** — 11 findings (blank page on bad URLs, permanent loading dead-ends when the backend is unreachable, Enter not submitting forms, WCAG touch-target/contrast gaps, and more), all fixed and verified.
- **Two real defects found post-deploy, both fixed same-session:** a Vercel SPA-fallback gap (deep links and refreshes 404'd in production), and a session dead-end where a student who exhausted all hints without yet submitting a wrong answer saw neither a hint button nor a Reveal Solution button — found by the user's own hands-on production testing, not by any automated pass.

Full detail: [`Release-0.1.2-Final.md`](Release-0.1.2-Final.md).

---

## Curriculum Expansion Milestone (commit `fbc7eed`)

- **New chapter: A Square and A Cube** — 40 questions, full Topic/Learn content. Matches NCERT's own current "Ganita Prakash" syllabus, which already merges Squares/Square Roots and Cubes/Cube Roots into one chapter.
- **Rational Numbers expanded 5 → 40 questions**, Topic replaced with a 5-section explanation (closure/commutativity/associativity, distributivity and identities, inverses, the number line).
- **Practical Geometry expanded 5 → 35 questions**, still intentionally has no Topic/Learn page — see "Current chapters" above for why its export path differs from the other five.
- No frontend, evaluation, coaching, or session-architecture changes — content-only, per this milestone's explicit scope.

Full detail: `Phase-1-Handoff.md` §8, §12.6, §17.

---

## Known limitations

- Exact-string-match answer evaluation is brittle for some question formats (a correctly-typed answer in an unexpected format is marked wrong) — a known, accepted limitation, not a bug; see Phase 1 roadmap.
- No "list my classes" endpoint — a teacher who navigates away loses their join code permanently (mitigated with a prominent, copy-button code display, not solved).
- No length limit on user-supplied names anywhere in the schema.
- The Learn page's content loses its authored section headings in the export pipeline (paragraphs are recoverable, headings are not, without a schema change).
- No visual/screenshot verification has been possible in the current development environment across multiple sessions — all UI work is verified via DOM geometry, computed style, and live behavioral walkthrough, which is rigorous for correctness but blind to aesthetics.

---

## Phase 1 roadmap (brief)

In priority order: (1) backend name-length limits, (2) a "list my classes" endpoint, (3) correct the Session page's `<h1>` in Test mode, (4) recover Topic section headings through a schema change, (5) address answer-matching brittleness (fuzzy matching and/or multiple-choice for the questions where exact-match genuinely doesn't work), (6) a real teacher dashboard (roster, class-wide progress) — currently the single biggest gap between "student tool" and "school-ready product." Full reasoning and recommended sequencing: `Phase-1-Handoff.md` §13–14.

---

## Documentation conventions

**Canonical documents** — living, actively maintained, trust these for current state:
```
README.md                (this file)
Deployment-Guide.md
Phase-1-Handoff.md
Release-0.1.2-Final.md
Product-Vision.md · ProductArchitecture.md · LearningExperienceArchitecture.md
Roadmap.md · Backlog.md · Idea-Inbox.md
Development-Journal.md · Release-Notes.md · PROJECT_STATUS.md
Wireframes.md · Developer-Runbook.md
ADR/*.md (all seven accepted ADRs)
```

**Historical documents** — retained for reference, no longer updated except where a moved-file citation needed a path fix:
```
HANDOFF_PROMPT.md                  (superseded by Phase-1-Handoff.md — see that file's own header)
archive/                           (previous release reports, RC reviews, implementation plans,
                                     audit drafts, and one content-authoring coverage report —
                                     each superseded by a living document or a shipped decision;
                                     real historical value, no ongoing-reference value)
```

If a document isn't in either list above, treat it as living unless it's inside `archive/`.
