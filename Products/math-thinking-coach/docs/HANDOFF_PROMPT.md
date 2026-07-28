# Handoff Prompt — Math Thinking Coach

*Paste this document as the first message of a new chat to resume work with minimal re-explanation. This file is part of the repository — the repository is the source of truth; where anything below conflicts with what you observe in the code, trust the code and treat this document as stale. Regenerate it at the next stable checkpoint rather than letting it drift.*

---

## 1. Who you are on this project

You are the Senior Software Engineer inside the **AI Builder Operating System**, a multi-product workspace at `C:\Users\rbala\BuilderWorkspace`. Read these first — short, and this handoff doesn't replace them:

1. [`AI-Builder-OS/CLAUDE.md`](../../../AI-Builder-OS/CLAUDE.md) — role, workflow, hard rules. Key ones: don't redefine architecture or product direction unless asked; implement only agreed scope; verify build/lint/tests before calling anything done; commit only after verification. Also defines the **Engineering vs. Product documentation** split: `Development-Journal.md`, `Release-Notes.md`, and accepted ADRs describe only completed reality; `Product-Vision.md`, `Roadmap.md`, and `Idea-Inbox.md` are intentionally forward-looking and exempt from that rule; `Backlog.md` holds approved-but-unscheduled work only.
2. [`AI-Builder-OS/ENGINEERING_PRINCIPLES.md`](../../../AI-Builder-OS/ENGINEERING_PRINCIPLES.md) — simplicity over cleverness, reuse through need, small commits, fix root causes.
3. [`AI-Builder-OS/DOCUMENTATION_STANDARDS.md`](../../../AI-Builder-OS/DOCUMENTATION_STANDARDS.md) — what each doc file is for (§10 below) and when to update it.
4. [`Products/math-thinking-coach/prompts/AI_Coding_Standards.md`](../prompts/AI_Coding_Standards.md) — no new top-level folders or dependencies without approval, mirror source structure in tests, never move/delete files unless instructed.

This project (`Products/math-thinking-coach/`) is one product in that workspace. `AI-Builder-OS/CHATGPT_PLAYBOOK.md` describes a ChatGPT-plans / Claude-implements workflow you may see feature specs arrive from — treat them as the user's request, not something to originate yourself.

---

## 2. Product vision and pedagogy

An AI-powered **Math Thinking Coach** for Class 8 CBSE students, evolving toward an **AI Learning Companion**: guide students to *think through* problems, and — as of the direction set alongside Release 0.1 — teach them, not just quiz them. Full detail in two documents with distinct, non-overlapping jobs:

- [`Product-Vision.md`](Product-Vision.md) — why the product exists: mission, target audience, coaching-vs-assessment philosophy, curriculum integrity, extensibility principles.
- [`LearningExperienceArchitecture.md`](LearningExperienceArchitecture.md) — **how students learn**, the pedagogical counterpart to this document. Defines the full learning journey (Learn → Understand → Worked Examples → Guided Practice → Independent Practice → Homework → Revision → Mastery), the `Topic` model, what's AI-authored (always offline, human-reviewed) vs. deterministic, and which Release delivers which stage. Read this before proposing any Release 0.2+ feature — find its stage there first.

---

## 3. Architectural decisions (read before touching evaluation, AI, or persistence code)

**[ADR-001](ADR/ADR-001-evaluation-coaching-separation.md) — Evaluation/Coaching separation (Accepted).** `answer_service.evaluate_answer` is a thin orchestrator over two independent collaborators: `evaluation_service.evaluate()` (correctness only) and `coaching_service.decide()` (attempt-based coaching only). This seam is *the* extension point for any future evaluation strategy.

**[ADR-002](ADR/ADR-002-shadow-mode-execution-and-logging.md) — Shadow Mode execution and logging (Accepted).** An experimental AI evaluator runs out-of-band (FastAPI `BackgroundTasks`) alongside the rule-based evaluator on every real answer submission, logging one JSONL record per submission. Zero production behavior change — enforced and verified, not just intended. Feature-flagged via `SHADOW_MODE_ENABLED` (default on).

**[ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md) — Content authoring and export pipeline (Accepted).** New content is authored in `docs/content-source/<chapter>/` (a 5-stage trail, `reviewStatus`-gated) and, once approved, merged into runtime `backend/app/data/*.json` by a 7-phase Stage 10 Export Pipeline (`docs/content-pipeline/export/`) that validates against the real backend Pydantic schemas and writes atomically, per-chapter, never a whole-file overwrite. A companion "Template Engine v1" (`docs/content-pipeline/template-engine/`) generates and independently verifies question candidates at volume. This is how Linear Equations grew from 5 to 44 questions and gained its Topic.

**Release 0.1's frontend persistence pattern (not yet its own ADR — see §11).** `progressService.ts` is the only interface any component uses; `progressStore.ts` is the only file that touches `localStorage`. Mirrors ADR-001's service-in-front-of-private-accessor shape, applied to the frontend for the first time. See `ProductArchitecture.md` §6.

All three accepted ADRs record real, implemented decisions, verified against shipped code — not proposals. Before touching evaluation, Shadow Mode, the progress-persistence layer, or content authoring/export, read the relevant section in full first.

---

## 4. Current architecture

**Stack** — Frontend: React 19 + TypeScript + Vite, React Router, Vitest + Testing Library, oxlint. Backend: Python 3.13, FastAPI, Pydantic, pytest + httpx. REST/JSON under `/api/v1`, no auth. AI: rule-based evaluation drives coaching (unchanged since Feature 010); an AI evaluator also runs in production, out-of-band, logging-only (Feature 015). No AI is in the response path. No backend persistence exists — Release 0.1's progress tracking is entirely client-side. Content authoring/export tooling (Node.js, `docs/content-pipeline/`) is build-time only, never imported by `app/*` or `frontend/src/*` — see ADR-003.

**Backend** (`backend/app/`)
```
main.py                        FastAPI app, CORS (localhost:5173 only), mounts api_router at /api/v1
api/router.py, api/routes/     health, chapters, questions, topics, answers — routes stay thin, delegate to services
core/config.py                 Settings: app + api_prefix + five shadow_* settings (env-driven)
core/logging.py                basic logging config
data/                          chapters.json, questions.json (public, topicId optional), topics.json (public),
                                answer_keys.json (private, one reader)
schemas/                       Pydantic models: chapter, question, topic, answer, ai_evaluation
services/
  question_service.py          content lookup
  topic_service.py             Topic lookup (Feature 018) — same load-once-module-level pattern as question_service
  evaluation_service.py        rule-based correctness + get_expected_answer() accessor (ADR-001/002)
  coaching_service.py          attempt-based coaching logic — untouched by Shadow Mode, Release 0.1, Features 018–021
  answer_service.py            thin orchestrator — untouched by Shadow Mode, Release 0.1, Features 018–021
  ai_evaluation_{client,prompt,service}.py   Shadow Mode's AI evaluator (promoted from the Feature 014 spike)
  shadow_evaluation_service.py Shadow Mode's out-of-band orchestrator, dispatched via BackgroundTasks
  shadow_log_writer.py         thread-safe JSONL append
experiments/ai_evaluation/     Feature 014's original harness — untouched, not imported by app/*
tests/                         pytest, one file per module — 65/65 passing
```

**Content pipeline** (`docs/`, build-time only — see [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md))
```
content-source/<chapter>/      Authoring trail: stage2 (topic detection) .. stage6 (questions), canonical-topic.json.
                                reviewStatus-gated ("ai-generated" default, "approved" required to export).
content-pipeline/
  template-engine/             Feature 019 — seeded, validated procedural question generation (node run.js ...)
  export/                      Feature 021 — Stage 10 Export: 7-phase gated merge into backend/app/data/*.json
                                (node run.js --chapter=<slug> [--dry-run]); shells out to backend/.venv for real
                                Pydantic validation. No automated test suite for this tooling itself.
```

**Frontend** (`frontend/src/`)
```
pages/         Home, ChapterSelection, Chapter (repurposed as Chapter Overview — Release 0.1; now also routes into
                Topic when one exists — Feature 018), Question, Topic (Feature 018 — explanation, worked example,
                learning objectives, "Start Practice")
components/    ChapterCard (progress badge — Release 0.1), AnswerInput, HintPanel, SolutionPanel,
               DifficultyBadge, ProgressBar, QuestionProgress
services/
  questionService.ts   the only place components fetch content — async, fetch-based; now also getTopics/getTopic
  progressService.ts   Release 0.1 — the only interface for progress (localStorage-backed)
  progressStore.ts     Release 0.1 — the only file that touches localStorage; never imported outside progressService
types/         chapter, question, answer, progress (Release 0.1), topic (Feature 018) — hand-kept in parity with
               backend schemas where applicable
config/api.ts
tests/         mirrors src/ 1:1 for components and services; no page-level tests (verified via live walkthrough instead)
```

**Data flow** — `backend/app/data/*.json` is the single source of truth for content; frontend has no local copies. `answer_keys.json` is private, read only through `evaluation_service.get_expected_answer()`. New content originates in `docs/content-source/`, not by hand-editing `backend/app/data/*.json` directly, once a chapter has been migrated onto the pipeline (Linear Equations only, so far — Data Handling, Practical Geometry, Understanding Quadrilaterals, and Rational Numbers still carry their original hand-seeded questions). Progress lives entirely in the browser (`localStorage`, key `mtc.progress.v1`, schema-versioned) — no server-side record, no accounts, no multi-device sync.

---

## 5. Development workflow on this project

1. **Design** — grounded in the actual current repo, not assumptions. No code.
2. **Review** — the user challenges the recommendation, asks for specific confirmations, sometimes redirects mid-review.
3. **Approval** — explicit, before any code is written.
4. **Small implementation slices** — each independently testable, not one large diff.
5. **Tests** — every slice ships with tests; adversarial tests (force a failure, force a disabled state) matter as much as happy-path ones for anything touching a response contract.
6. **Documentation** — updated after implementation and verification, describing what was actually built, plus a new ADR if the decision is significant and hard to reverse.
7. **Final verification** — a real end-to-end review before calling a Feature or Release complete: re-run tests fresh (don't trust earlier slices' results), check for dead code/stale comments/duplication, live-verify UI-observable changes.

Don't skip steps 1–3 by jumping to implementation on a request that reads like a spec.

---

## 6. Current project status

- **Release 0.1 ("It Remembers You") is complete** — Feature 016 (Progress Persistence Layer) + Feature 017 (Chapter Overview & Continue Learning).
- **Release 0.2, first slice implemented (not complete)** — Features 018–021 (Topic data model & API, Template Engine v1, content authoring pipeline, Stage 10 Export Pipeline — see [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md)), shipped in parallel with Release 0.1 the same day. Linear Equations migrated end-to-end (5 → 44 questions, 1 Topic, live). Data Handling authored through stage 6 (42 questions) but not exported. Release 0.2's Understand stage not yet built.
- **65/65 backend tests, 40/40 frontend tests passing.**
- **Feature 015 (Shadow Mode)** shipped 2026-07-23, still operable, still hasn't accumulated a meaningful sample.
- **Next engineering objective**: none formally queued. Active, non-blocking tracks: operate Shadow Mode and gather data (toward scoping confidence-gated live evaluation, not yet numbered); export Data Handling's already-authored questions (nearest content win); get this checkpoint committed. Don't assume further Release 0.2 engineering (Understand stage, more chapters) is approved to start — see §11.
- **Branch**: `main`, ahead of `origin/main`, nothing pushed. **Committed**: Features 007–012 (`90e547b`), Feature 014 spike (`e98d744`), Product Foundation Sprint docs (`ae27076`). **Uncommitted**: everything since — Feature 015 (backend), Release 0.1 (frontend), Features 018–021 (backend + frontend + `docs/content-pipeline/` + `docs/content-source/`), and all documentation through this checkpoint (2026-07-28). Run `git status` to confirm before doing anything; ask the user whether/how to commit.

Run `pytest` and `vitest run` yourself and re-check `git status`/`git log` before trusting any number above. This checkpoint's own history is a cautionary example: Features 018–021 were implemented and verified on 2026-07-27 but left undocumented and uncommitted until a 2026-07-28 reconciliation pass caught the gap — don't let engineering outrun documentation the same way again.

---

## 7. Repository conventions and coding standards

- Ask before assuming when a spec conflicts with existing architecture — stop and clarify.
- Minimal, focused diffs. Don't refactor unrelated code. Don't rename/move files unless asked.
- No new dependencies or top-level folders without justification and approval.
- Routes/components stay thin; business logic lives in services (backend `app/services/*.py`, frontend `src/services/*.ts`) — followed with zero exceptions so far, on both sides.
- Python: Pydantic models for every request/response shape, `response_model=` on every route. Plain function modules for services, not classes.
- TypeScript: strongly typed; plain function modules exported as one object literal (`export const xService = {...}`), not classes — same convention on both `questionService.ts` and `progressService.ts`.
- No comments explaining *what* code does — only genuinely non-obvious constraints.
- Commit messages: Conventional Commits (`feat(scope): ...`, `refactor(scope): ...`, `docs: ...`). Only commit when the user asks, only after tests are green, and per Release 0.1's practice: code and the documentation describing it belong in the same commit (`CLAUDE.md`'s Documentation Responsibility treats docs as part of Definition of Done).
- **Releases vs. Features**: Releases (`Roadmap.md`, `Backlog.md`, `PROJECT_STATUS.md`) describe what students receive; Features (`Development-Journal.md`, one entry per Feature) describe what engineers build, tracked *inside* a Release (e.g. Release 0.1 = Feature 016 + Feature 017). Features 007–015 predate this convention and are never renumbered.

---

## 8. Current REST API surface

```
GET  /api/v1/health
GET  /api/v1/chapters
GET  /api/v1/chapters/{chapterId}                          → 404 if unknown
GET  /api/v1/chapters/{chapterId}/questions                → 404 if chapter unknown
GET  /api/v1/chapters/{chapterId}/questions/{questionId}   → 404 if chapter or question unknown
GET  /api/v1/chapters/{chapterId}/topics                   → 404 if chapter unknown, [] if chapter has no topics
GET  /api/v1/topics/{topicId}                               → 404 if unknown

POST /api/v1/questions/{questionId}/answer                 → 404 if question unknown, 422 on invalid body
  Request:  { "submission": { "answer": string, "attemptNumber": number } }
  Response: {
    "evaluation": { "isCorrect": boolean, "score": 1.0 | 0.0 },
    "coach": { "message": string, "nextAction": "TRY_AGAIN" | "SHOW_HINT" | "SHOW_SOLUTION" | "NEXT_QUESTION" },
    "ui": { "canTryAgain": boolean, "canRevealSolution": boolean, "hintLevel": 0 | 1 | 2 }
  }
```
The answer-evaluation contract is unchanged by Feature 015, Release 0.1, or Features 018–021 — all additive and/or out-of-band. `Chapter`: `{id, title, description}`. `Question`: `{id, chapterId, question, text, difficulty, hints[], solution, topicId}` — `topicId` (Feature 018) is optional and never includes an expected/short answer. `Topic`: `{id, chapterId, title, explanation, workedExampleContent, learningObjectives[]}`. Progress tracking has no backend endpoint at all — it's entirely client-side (§4).

---

## 9. Testing approach

Backend: pytest + `TestClient`, one file per module, 65/65 passing. Frontend: Vitest + Testing Library, `tests/` mirrors `src/` for components and services 1:1 — **no page-level tests exist anywhere in this repo**, by established convention; page behavior (`HomePage`, `ChapterPage`, `QuestionPage`, `TopicPage`) is verified via live browser walkthrough instead, every time. Before calling anything done: backend `pytest`; frontend `tsc -b` + `oxlint` + `vitest run`; a live walkthrough with both servers running for anything UI-observable, including a fresh-profile *and* an existing-state path when persistence is involved (Release 0.1 established this pattern — see `Development-Journal.md`'s 2026-07-27 entries for exactly what that looked like). Re-run the full suite fresh at a Feature/Release boundary — don't trust results from earlier slices. **The content pipeline (`docs/content-pipeline/`) has no automated test suite of its own** (ADR-003) — verify it with `node docs/content-pipeline/export/run.js --chapter=<slug> --dry-run` before trusting its output.

---

## 10. Documentation map

| File | Purpose | State |
|---|---|---|
| `Product-Vision.md` | Why the product exists — living | Current |
| `ProductArchitecture.md` | How it's built — stack, folders, API, Progress Persistence, Content Architecture | Current through Features 018–021 (14 numbered sections) |
| `LearningExperienceArchitecture.md` | How students learn — pedagogical counterpart to ProductArchitecture.md | Current |
| `Roadmap.md` | Phased capability themes — living | Current |
| `Idea-Inbox.md` | Raw, unfiltered, append-only ideas — living | Current |
| `Backlog.md` | Approved future work only | Current |
| `Development-Journal.md` | Append-only engineering diary | Current through 2026-07-27 (Features 016–021) |
| `Release-Notes.md` | User-visible changes only | Current through Release 0.1 — Features 018–021 have no student-visible surface yet worth a release note beyond the Topic page itself (small, optional "Learn" button); add one if/when Release 0.2 is called done |
| `PROJECT_STATUS.md` | At-a-glance dashboard | Current |
| `ADR/` | Accepted architecture decisions | ADR-001, ADR-002, ADR-003 |
| `HANDOFF_PROMPT.md` | This file | Regenerated 2026-07-28 (reconciliation checkpoint) |
| `Wireframes.md` | Screen-level UI reference | Current through Release 0.1 — **not yet updated for TopicPage**, a real gap |
| `README.md` | Docs index | Stable |

---

## 11. Release 0.2 readiness

Features 018–021 delivered Release 0.2's Learn + Worked Examples stages for one chapter (Linear Equations) — this is real engineering progress, not just readiness-checking. What's still true from the original readiness assessment, and what's changed:

- **Schema**: `progressStore.ts`'s `schemaVersion` mechanism still hasn't needed a bump — Topic content is served from the backend, not stored in progress state. No change needed here.
- **Service boundaries / navigation / folder organization**: validated in practice, not just in theory — `ChapterPage` was in fact the natural insertion point for the Learn step, exactly as predicted.
- **What's left for Release 0.2 to be "complete," not just started**: export Data Handling (content is ready); the Understand stage (comprehension check) isn't built for any chapter yet; Practical Geometry, Understanding Quadrilaterals, and Rational Numbers haven't been through the pipeline at all — Rational Numbers has only a hand-seeded placeholder Topic.
- **Not yet decided**: whether Release 0.2 ships chapter-by-chapter as each is migrated, or waits for all five. Raise this with the user before assuming either.

Do not begin further Release 0.2 engineering (or a next milestone) without a fresh design/review/approval pass, per §5.

---

## 12. Immediate next steps for a new session

1. Run `git status` and `git log --oneline -6` yourself — §6 may be stale by the time you read it.
2. Re-run backend `pytest` and frontend `vitest run` to confirm 65/65 and 40/40 still hold.
3. Ask the user what they want to work on — do not assume further Release 0.2 engineering is approved to start just because it's the named "next" theme. Per §6, confirm whether the priority is committing this checkpoint, exporting Data Handling, operating Shadow Mode, or new engineering, before proceeding.
