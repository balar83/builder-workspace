# Handoff Prompt — Math Thinking Coach

*Paste this entire document as the first message of a new Claude Code chat to resume work with zero loss of context. This file is itself part of the repository — the repository is the source of truth; where anything below conflicts with what you observe in the code, trust the code and treat this document as stale.*

---

## 1. Who you are on this project

You are acting as the Senior Software Engineer inside the **AI Builder Operating System**, a multi-product workspace at `C:\Users\rbala\BuilderWorkspace`. Read these governing documents in full before doing anything else — they are short and this handoff does not replace them:

1. [`AI-Builder-OS/CLAUDE.md`](../../../AI-Builder-OS/CLAUDE.md) — your role, workflow, and hard rules. Key ones: **do not redefine architecture or product direction unless explicitly asked**; implement only agreed scope; verify build/lint/tests before considering anything done; commit only after verification; documentation reflects completed reality only, never plans.
2. [`AI-Builder-OS/ENGINEERING_PRINCIPLES.md`](../../../AI-Builder-OS/ENGINEERING_PRINCIPLES.md) — simplicity over cleverness, reuse through need (not premature abstraction), small incremental commits, fix root causes.
3. [`AI-Builder-OS/DOCUMENTATION_STANDARDS.md`](../../../AI-Builder-OS/DOCUMENTATION_STANDARDS.md) — what each doc file is for (see §8 below) and when to update them.
4. [`Products/math-thinking-coach/prompts/AI_Coding_Standards.md`](../prompts/AI_Coding_Standards.md) — project-specific rules: no new top-level folders without approval, no dependencies without approval, mirror source structure in tests, never move/delete files unless explicitly instructed.

This project (`Products/math-thinking-coach/`) is one product inside that workspace. There is a separate `AI-Builder-OS/CHATGPT_PLAYBOOK.md` describing a ChatGPT-does-planning / Claude-does-implementation workflow — you may be handed feature specs that originated that way; treat them as the user's request, not as something you generated.

---

## 2. Product vision (from `docs/Product-Vision.md` and `docs/ProductArchitecture.md`)

An AI-powered **Math Thinking Coach** for Class 8 CBSE students. The point is to guide students to *think through* problems rather than hand them answers: student attempts first, hints are progressive and optional, the full solution is the last resort, and any AI involved acts as a coach, not an answer machine. Mobile-first, minimal UI, one primary action per screen.

---

## 3. Current architecture (verified against the actual filesystem, not just docs)

### Tech stack
- **Frontend**: React 19 + TypeScript + Vite 8, React Router, Vitest + Testing Library, oxlint. No CSS framework — local `.css` files per component/page.
- **Backend**: Python 3.13, FastAPI, Uvicorn, Pydantic, python-dotenv, pytest + httpx (via `TestClient`).
- **Communication**: REST over HTTP, JSON, versioned under `/api/v1`. No auth yet.
- **AI**: none integrated yet. Answer evaluation is currently deterministic rule-based logic; LLM integration is an explicit future phase (see §11).

### Folder structure (actual, current)

```
Products/math-thinking-coach/
├── backend/
│   ├── app/
│   │   ├── main.py                  FastAPI app, CORS, mounts api_router at /api/v1
│   │   ├── api/
│   │   │   ├── router.py            central api_router, includes all route modules
│   │   │   └── routes/
│   │   │       ├── health.py        GET /health
│   │   │       ├── chapters.py      GET /chapters, GET /chapters/{id}
│   │   │       ├── questions.py     GET /chapters/{id}/questions[/{id}]
│   │   │       └── answers.py       POST /questions/{id}/answer
│   │   ├── core/
│   │   │   ├── config.py            Settings (APP_NAME, APP_VERSION, API_PREFIX) via .env
│   │   │   └── logging.py           basic logging config
│   │   ├── data/
│   │   │   ├── chapters.json        5 chapters — PUBLIC data, served as-is
│   │   │   ├── questions.json       25 questions — PUBLIC data, served as-is
│   │   │   └── answer_keys.json     questionId → expected answer — PRIVATE, never served
│   │   ├── schemas/                 Pydantic models: chapter.py, question.py, answer.py
│   │   ├── services/                business logic: question_service.py, answer_service.py
│   │   └── models/                  empty placeholder (no ORM/DB yet)
│   ├── tests/                       pytest, one file per route module, TestClient-based
│   ├── requirements.txt, pytest.ini, .env.example, README.md
│   └── .venv/                       local virtualenv (gitignored)
│
├── frontend/
│   ├── src/
│   │   ├── pages/                   HomePage, ChapterSelectionPage, ChapterPage, QuestionPage
│   │   ├── components/              ChapterCard, AnswerInput, HintPanel, SolutionPanel, DifficultyBadge, ProgressBar, QuestionProgress (+ matching .css)
│   │   ├── services/questionService.ts   the ONLY place components may reach data — all methods are async and call the backend over fetch
│   │   ├── config/api.ts            API_BASE_URL, from VITE_API_BASE_URL env var
│   │   ├── types/                   chapter.ts, question.ts, answer.ts — kept in exact field-for-field sync with backend Pydantic schemas
│   │   ├── App.tsx, main.tsx, vite-env.d.ts
│   ├── tests/                       Vitest; components/ mirrors src/components/, services/ mirrors src/services/
│   └── .env.example
│
└── docs/                            see §8
```

**Important drift to know about:** `prompts/AI_Coding_Standards.md` describes an aspirational structure with `frontend/src/features/{chapters,questions,hints,solutions,history}/`, `hooks/`, `utils/`. **This does not exist yet.** The actual structure is flatter: `pages/` + `components/` + `services/` + `types/` + `config/`. Don't be surprised by the mismatch, and don't unilaterally restructure to match the aspirational doc — that would be exactly the kind of unrequested architectural change `CLAUDE.md` says not to make.

### Data flow / key design pattern

`backend/app/data/*.json` is the **single source of truth** for chapter and question content — the frontend has no local copy of anything (its old `src/data/chapters.ts`/`questions.ts` were deleted once the API existed). All frontend data access goes through `questionService.ts`, which is a thin async wrapper over `fetch` calls to the backend; components never call `fetch` directly and never import data files.

`answer_keys.json` is architecturally separate from `chapters.json`/`questions.json`: it is read only by `answer_service.py` and is never merged into any Pydantic response model, so there is no route through which a client can read the expected answer for a question. This was a deliberate security-conscious decision (see §11).

---

## 4. Completed milestones

All four backend/API features to date, in order:

| # | Feature | What it delivered |
|---|---------|--------------------|
| 007 | Backend Foundation | FastAPI skeleton: `main.py`, `/api/v1` prefix, CORS for `localhost:5173`, `.env`-driven config, logging, `GET /api/v1/health`. |
| 008 | Frontend Service Layer | Introduced `questionService.ts` so components stop importing `src/data/*.ts` directly. At this point the service still wrapped **local static data** — no backend calls yet. |
| 009 | Question Retrieval API | `GET /api/v1/chapters`, `GET /api/v1/chapters/{chapterId}`, `GET /api/v1/chapters/{chapterId}/questions`, `GET /api/v1/chapters/{chapterId}/questions/{questionId}`. `questionService` switched from local data to real `fetch` calls; `src/data/chapters.ts`/`questions.ts` deleted. Pages (`ChapterSelectionPage`, `ChapterPage`, `QuestionPage`) converted from synchronous render-time data access to `useEffect`/`useState` async loading — this was a deliberate, user-approved exception to "don't touch components," confirmed via clarifying question before implementing, because a real HTTP-backed service cannot be synchronous. |
| 010 | Answer Evaluation API (Rule-Based) | `POST /api/v1/questions/{questionId}/answer`. Deterministic exact-match (whitespace-trimmed) comparison against a private answer key; attempt-number-driven coaching messages and `nextAction`/`ui` state. Frontend `submitAnswer` wired into the existing "Check Answer" button; only `coach.message` is rendered (in the same slot that used to show a static placeholder) — the rest of the response (`isCorrect`, `score`, `nextAction`, `ui.*`) is captured in state but intentionally not yet acted on in the UI. |

Before Feature 007, there was already a working **Frontend MVP**: chapter selection → chapter detail → multi-question flow with progressive hints → solution reveal → chapter-complete, all against local static data.

Full narrative detail for every feature (including the back-and-forth on design decisions) is in [`Development-Journal.md`](Development-Journal.md) — read the `2026-07-22` entries for 007–010.

---

## 5. Current project status — read this before doing anything

Run these yourself to confirm; do not trust stale numbers.

- **Branch**: `main`.
- **Feature 010 is committed.** Latest relevant commit: `42371e0 feat(api): add rule-based answer evaluation endpoint`. Features 007–010 are all committed. What remains uncommitted is only this handoff/status documentation itself (`docs/Backlog.md`, `docs/PROJECT_STATUS.md`, `docs/HANDOFF_PROMPT.md`) — run `git status` first to confirm, and ask the user whether to commit those too.
- **Backend**: 20/20 pytest passing (`health`, `chapters`, `questions`, `answers` test modules). `uvicorn app.main:app` starts cleanly. Python 3.13.5 via a project-local `.venv` (see §10 for the exact path quirk on this machine).
- **Frontend**: `tsc -b && vite build` passes, `oxlint` clean, 18/18 vitest passing (`components/*` + `services/questionService.test.ts`).
- Full manual browser walkthrough completed for Feature 010: correct-answer flow, incorrect attempts 1/2/3 (each producing the right coaching message), hint reveal and solution reveal confirmed still working exactly as before (regression-checked), 404 handling for unknown chapter/question, and confirmed via `curl` that `GET /chapters/{id}/questions/{id}` never leaks the answer key.

---

## 6. Repository conventions you must follow

- **Ask before assuming** when a new feature spec conflicts with what's already built or with stated architecture — this happened twice already in this project's history (see §11) and both times the right move was to pause and ask rather than silently pick a side.
- **Minimal, focused diffs.** Don't refactor unrelated code while implementing a feature. Don't rename or move files unless explicitly asked.
- **No new dependencies without justification and approval.** `AI_Coding_Standards.md` §10 is explicit about this.
- **No new top-level folders without approval.**
- **Routes stay thin; business logic lives in services** (`app/services/*.py` on the backend). This has been followed consistently: `answers.py` (route) does only a 404 existence check and delegates to `answer_service.evaluate_answer`.
- **Commit messages**: this repo uses Conventional Commits style (`feat(scope): ...`, `refactor(scope): ...`, `chore(scope): ...`, `docs: ...`) — follow the existing log (`git log --oneline`) for the pattern.
- **Only commit when the user asks**, and only after build/lint/tests are verified green.

---

## 7. Coding standards

- TypeScript: strongly typed, `noUnusedLocals`/`noUnusedParameters` enabled — keep it that way. Frontend types (`src/types/*.ts`) are hand-kept in exact field-for-field parity with backend Pydantic schemas (same field names, including camelCase like `chapterId`/`attemptNumber` — no snake_case aliasing on the backend) so `response.json()` can be returned directly with zero mapping layer. If you change one side, change the other and verify parity (this was explicitly checked and confirmed once already — see Development-Journal).
- React: functional components + hooks only, no class components. Async data loading uses local `useEffect`/`useState` with a `cancelled` flag pattern to avoid race conditions/setting state after unmount — see any of the three page components for the pattern to copy.
- Python: Pydantic models for all request/response shapes, `response_model=` declared explicitly on every route (this is also what keeps `answer_keys.json` safely private — see §11). Plain module-level functions for services, not classes (`question_service.py`, `answer_service.py` — both are function modules, not `AnswerEvaluationService`-style classes). No FastAPI `Depends()`-based dependency injection has been introduced yet; services are imported and called directly.
- No comments explaining *what* code does; only where a non-obvious constraint or workaround needs explaining (rare so far — the codebase has almost none).

---

## 8. Documentation map — what's where and what it's for

Per `DOCUMENTATION_STANDARDS.md`, only update the docs actually impacted by a change; keep documentation describing *completed* reality, never plans.

| File | Purpose | Current state |
|---|---|---|
| `docs/Product-Vision.md` | Why the product exists | Stable, unlikely to need changes |
| `docs/ProductArchitecture.md` | How the system is built — stack, folder structure, **API endpoint reference (Implemented vs Planned)**, ADR table | Kept current through Feature 010 |
| `docs/Development-Journal.md` | Append-only chronological engineering diary | Current through Feature 010 (`2026-07-22` entry) — **append, never rewrite** |
| `docs/Release-Notes.md` | User-visible changes only, no implementation detail | Current through Feature 010 |
| `docs/Backlog.md` | Approved future work, prioritized | Just corrected as part of this handoff — previously stale/mis-numbered, see §11 |
| `docs/PROJECT_STATUS.md` | Compact at-a-glance dashboard (milestone, completed features, current branch, last-verified checklist) | Just updated as part of this handoff |
| `docs/HANDOFF_PROMPT.md` | This file | Regenerate or update at the next stable checkpoint |
| `docs/Wireframes.md` | Screen-level UI reference | Stable |
| `docs/README.md` | Index of the docs folder | Stable |
| `backend/README.md`, `frontend/README.md` | Setup/run instructions per app | Stable |

---

## 9. Testing approach

- **Backend**: pytest + FastAPI `TestClient`, one test file per route module (`test_health.py`, `test_chapters.py`, `test_questions.py`, `test_answers.py`), all under `backend/tests/`. Pattern: instantiate `TestClient(app)` at module scope, one test function per scenario, assert on `status_code` and `response.json()` (often full-dict equality for response-shape tests). `test_answers.py` is the most complete example — covers correct/incorrect/whitespace/attempt-progression/404/empty-answer/422-validation.
- **Frontend**: Vitest + Testing Library. `tests/components/*` mirrors `src/components/*` one-to-one. `tests/services/questionService.test.ts` mocks `global.fetch` via `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok, status, json}))` — copy this pattern for any new service methods. No page-level tests exist yet (page behavior has instead been verified via live browser walkthroughs each feature — see Development-Journal "Verification summary" entries).
- **Before calling anything done**: backend `pytest`, frontend `tsc -b && vite build` + `oxlint` + `vitest run`, and — per this session's established practice — a live browser walkthrough with both servers actually running whenever the change is observable in the UI (chapter list → question → hints → solution, or whatever the feature touches). Screenshots/network-request checks were used throughout; don't skip this for UI-observable changes just because unit tests pass.

---

## 10. Environment / tooling notes specific to this machine

- **Platform**: Windows, PowerShell primary shell, Bash tool also available (Git Bash / POSIX).
- **Python**: not on the default `PATH` cleanly (Windows Store alias shadows it). Use the real interpreter directly: `/c/Users/rbala/AppData/Local/Programs/Python/Python313/python.exe` (or the Windows path form) to create/use `.venv`. The backend's own `.venv` already exists at `Products/math-thinking-coach/backend/.venv` — activate or invoke it directly (`./.venv/Scripts/python.exe -m pytest`) rather than recreating it.
- **Frontend dev server / browser preview**: this environment has a Browser pane tool. `.claude/launch.json` at the workspace root (gitignored, machine-local — see `.gitignore` entry `# AI tooling (local/session-specific)` / `.claude/`) is configured with a `math-thinking-coach-frontend` entry (`npm run dev --prefix Products/math-thinking-coach/frontend`, port 5173). If it's missing in a fresh session, recreate it before trying to preview — `preview_start` needs it.
- Always start the backend (`uvicorn app.main:app --port 8000`) in the background before browser-verifying any frontend change that hits the API — CORS is configured for `http://localhost:5173` only.
- Clean up `__pycache__`/`.pytest_cache` after backend test runs if you want a tidy `git status` (they're gitignored but still clutter local exploration).

---

## 11. Key design decisions and their reasoning (condensed ADR-style)

1. **Data ownership flips from frontend to backend (Feature 009).** Chapter/question JSON moved to `backend/app/data/`, frontend's local copies deleted. Rationale: avoid manually duplicating the same content in two places; backend becomes the single source of truth once it exists.
2. **Async service required breaking "don't touch components" (Feature 009).** A synchronous `questionService` cannot wrap real `fetch` calls. Flagged as a genuine conflict via a clarifying question rather than assumed; user approved minimal `useEffect`/`useState` edits to the three page components. **Precedent**: when a new requirement is structurally incompatible with another stated constraint, stop and ask — don't silently pick one.
3. **Domain model parity is intentional and was explicitly verified.** Frontend TS types and backend Pydantic schemas are field-for-field identical (including camelCase `chapterId`), by design, so the service layer needs zero mapping code. If you add/change a field on one side, mirror it exactly on the other.
4. **Private answer-key store, not a public data-model field (Feature 010).** The spec required comparing against "the expected answer," but `Question` only has a full-sentence `solution`, not a short comparable answer. Rather than add `expectedAnswer` to the public `Question` schema (risking leakage through the existing GET endpoints), a separate `answer_keys.json` was added, read only inside `answer_service.py`, never merged into any response model. Verified live via `curl` that the public question endpoint doesn't expose it.
5. **Canonical answers for free-text questions are a known Phase-1 limitation.** ~5 of the 25 questions (quadrilateral properties, etc.) have descriptive rather than numeric/single-word answers; the exact-match rule means only one phrasing is accepted. This is explicitly the reason a future AI-based evaluator is on the roadmap.
6. **A later, differently-shaped spec for the same feature (`POST /api/v1/evaluate`, exposing `expectedAnswer` directly, adding a `misconception` field) was presented and explicitly declined by the user** in favor of keeping the Feature 010 contract as canonical. If you encounter any planning material describing that alternate `/evaluate` shape, it does **not** reflect the implementation — treat the `POST /api/v1/questions/{questionId}/answer` contract in §12 below as authoritative. This is the second precedent for "when specs conflict, ask — don't assume the newest one wins."
7. **Frontend surfaces only `coach.message`, nothing else, from the evaluation response (Feature 010).** `isCorrect`, `score`, `nextAction`, and all of `ui` are captured in component state but not yet used to drive any UI behavior (no auto-advance, no gated hint/solution reveal — those remain fully manual, exactly as before). This was a deliberate minimal-scope choice, not an oversight, and is the basis for the recommended Feature 011 in §13.

---

## 12. Current REST API surface (authoritative — verify against `backend/app/api/routes/*.py` if in doubt)

```
GET  /api/v1/health
GET  /api/v1/chapters
GET  /api/v1/chapters/{chapterId}                          → 404 if unknown
GET  /api/v1/chapters/{chapterId}/questions                → 404 if chapter unknown
GET  /api/v1/chapters/{chapterId}/questions/{questionId}   → 404 if chapter or question unknown

POST /api/v1/questions/{questionId}/answer                 → 404 if question unknown, 422 on invalid body
  Request:  { "submission": { "answer": string, "attemptNumber": number } }
  Response: {
    "evaluation": { "isCorrect": boolean, "score": 1.0 | 0.0 },
    "coach": { "message": string, "nextAction": "TRY_AGAIN" | "SHOW_HINT" | "SHOW_SOLUTION" | "NEXT_QUESTION" },
    "ui": { "canTryAgain": boolean, "canRevealSolution": boolean, "hintLevel": 0 | 1 | 2 }
  }
```

Coaching rule: correct → `NEXT_QUESTION`. Incorrect attempt 1 → `TRY_AGAIN`. Incorrect attempt 2 → `SHOW_HINT`. Incorrect attempt 3+ → `SHOW_SOLUTION`.

`Chapter` shape: `{ id, title, description }`. `Question` shape: `{ id, chapterId, question, text, difficulty: "Easy"|"Medium"|"Hard", hints: string[], solution }`. Neither ever includes an expected/short answer field.

---

## 13. Backlog and recommended next feature

See [`Backlog.md`](Backlog.md) for the full list (just corrected as part of this handoff — it previously had stale/mis-numbered entries from before implementation; the corrected file is now authoritative).

**Recommended Feature 011: Wire coaching UI state.** Feature 010 already returns `coach.nextAction` and `ui.{canTryAgain,canRevealSolution,hintLevel}`, but `QuestionPage.tsx` only renders `coach.message` today — hint reveal and solution reveal are still fully manual, unrelated to what the API just told the client to do. Wiring the existing response into the UI (e.g., gating/suggesting the hint or solution button based on `nextAction`) is low-risk (no backend changes needed), completes what Feature 010 intentionally deferred, and should happen before investing in LLM-based evaluation — validate the rule-based contract end-to-end in the UI first.

Other candidates, unscoped, roughly in plausible order: AI-based answer evaluation (replaces exact-match inside `answer_service.py` without changing the API contract — the extension point Feature 010 was explicitly built for), Adaptive Hint Engine, Student Progress History, Statistics Dashboard, Teacher Portal, then Phase 2+ items from `ProductArchitecture.md` (OCR scanner, voice input).

**Do not start implementing any of these without the user explicitly approving scope first** — per `CLAUDE.md`, architecture and product direction decisions happen before implementation, and this handoff is not that approval.

---

## 14. Immediate next steps for a new session

1. Run `git status` and `git log --oneline -5` yourself — confirm §5 is still accurate (it may not be, if the user committed or changed things between sessions).
2. Ask the user what they'd like to work on next — do not assume Feature 011 (§13) is approved just because it's recommended here.
3. Re-run backend `pytest` and frontend `vitest run` once to confirm the checkpoint in §5 still holds before building on top of it.
