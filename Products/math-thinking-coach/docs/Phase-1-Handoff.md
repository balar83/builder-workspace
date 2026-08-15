# Math Thinking Coach — Phase 1 Handoff

**Written:** 2026-08-07, immediately after Release 0.1.2 shipped to production.
**Updated:** 2026-08-15, after the Curriculum Expansion Milestone (commit `fbc7eed`) — see §8, §10, §17.
**Purpose:** let a brand-new Claude conversation continue this project with zero context loss. Read this document fully before touching code. Where anything here conflicts with what you observe in the repository, **trust the repository** — this document describes a snapshot, not a live source of truth.

---

## 1. Product vision

**Math Thinking Coach** is an AI-assisted coaching product for Class 8 CBSE mathematics students, currently evolving toward an **AI Learning Companion**. The core philosophy, non-negotiable and repeated throughout this project's documents: **coach students to think through problems, don't just quiz them.**

Concretely, this means:
- **Coaching over assessment by default.** Practice and Revision modes never show a score, no matter how the student did — score-free is the default state, not a missing feature. Test mode is the one, deliberately opt-in, self-feedback-framed exception where a score appears.
- **Progressive hints, never the answer up front.** Every question has 2–3 hints revealed one at a time, and a Reveal Solution action that never appears before that ladder is exhausted (or the server's own attempt-based coaching decides it's time).
- **Curriculum integrity.** Content is sourced from real NCERT Class 8 material (or, where that's not text-extractable — see §8 — authored directly from the same standard curriculum), reviewed before it goes live.
- **Minors, minimal data.** Students never provide email or password — only a class join-code, a display name, and a 4-digit PIN. No student email/password is collected anywhere in the system, by design.

Full detail: `Product-Vision.md` (why the product exists) and `LearningExperienceArchitecture.md` (how students learn — the full journey: Learn → Understand → Worked Examples → Guided Practice → Independent Practice → Homework → Revision → Mastery, and which Release delivers which stage).

---

## 2. Current architecture

**Stack:**
- **Frontend:** React 19 + TypeScript + Vite, React Router, Vitest + Testing Library, oxlint.
- **Backend:** Python 3.13, FastAPI, Pydantic, `sqlite3` (stdlib), pytest + httpx.
- **Communication:** REST/JSON under `/api/v1`.
- **AI:** rule-based evaluation drives coaching and the live response (exact-string match, see §12). An experimental AI evaluator ("Shadow Mode") runs out-of-band, logging-only, never influencing production behavior.
- **Persistence:** file-based JSON for content (`backend/app/data/*.json`, source-of-truth, no DB); file-based JSON for accounts (`teachers.json`, `classes.json`, `students.json` — gitignored, not committed); one SQLite file (`runtime.db`, gitignored) holding both attempt history and the Learning Session Engine's session state.
- **Deployment:** split hosting — Vercel (frontend, static) + Render (backend, always-on with a persistent disk). Both auto-deploy on push to `main`. See §18 for live URLs.

**Data flow:** `backend/app/data/*.json` is the single source of truth for content; the frontend has no local copies and fetches everything. `answer_keys.json` is private, read only through `evaluation_service.get_expected_answer()`, never exposed on any content GET route. Client-side anonymous progress lives in `localStorage` (`progressService`/`progressStore`), entirely separate from the server-side attempt history that exists for logged-in students.

---

## 3. Folder structure

```
Products/math-thinking-coach/
├── backend/
│   ├── app/
│   │   ├── main.py                FastAPI app, CORS, SessionMiddleware, router mount
│   │   ├── api/
│   │   │   ├── router.py
│   │   │   └── routes/            health, chapters, questions, topics, answers, auth, performance, sessions
│   │   ├── core/                  config.py (env-driven Settings), logging.py
│   │   ├── data/                  chapters.json, questions.json, topics.json, answer_keys.json (all committed);
│   │   │                          teachers/classes/students.json + runtime.db (all gitignored)
│   │   ├── schemas/                Pydantic models, one file per domain concept
│   │   ├── services/               business logic — routes stay thin, everything lives here
│   │   └── experiments/            Shadow Mode's original spike harness, untouched, not imported by app/*
│   └── tests/                      pytest, one file per module, 205/205 passing
├── frontend/
│   ├── src/
│   │   ├── pages/                  one file per route
│   │   ├── components/             shared UI pieces
│   │   ├── services/                the only place components talk to the backend or localStorage
│   │   ├── types/                   hand-kept in parity with backend schemas
│   │   ├── styles/tokens.css        the design-token system (new in 0.1.2, see §6)
│   │   ├── config/api.ts
│   │   ├── App.tsx                  route table
│   │   └── index.css, App.css       base styles + shared control styles
│   ├── tests/                       mirrors src/ 1:1 for components/services — no page-level tests, by convention
│   └── vercel.json                  SPA rewrite (new in 0.1.2 — see §17/§18, was missing and broke deep links)
└── docs/                            see §9 for ADRs; this file and Release-0.1.2-Final.md are the two newest documents
```

**Content pipeline** (`docs/content-pipeline/`, `docs/content-source/`) is build-time-only tooling, never imported by runtime code. See §8.

---

## 4. Backend overview

Routes stay thin; all logic lives in `services/`. Key services and what they own:

| Service | Owns |
|---|---|
| `question_service.py` | Content lookup (chapters/questions), loaded once at module level |
| `topic_service.py` | Topic lookup, same load-once pattern |
| `evaluation_service.py` | Rule-based correctness (`evaluate()`) + the private `get_expected_answer()` accessor |
| `coaching_service.py` | Attempt-based coaching decision — **pure function of `(is_correct, attempt_number)`**, nothing else. See §12 for why this is exactly the bug found in Release 0.1.2. |
| `answer_service.py` | Thin orchestrator composing evaluation + coaching (ADR-001) |
| `ai_evaluation_{client,prompt,service}.py`, `shadow_evaluation_service.py`, `shadow_log_writer.py` | Shadow Mode (ADR-002) — out-of-band, logging-only, zero production behavior change |
| `auth_service.py` | bcrypt hashing, atomic JSON-file read/write under a lock (ADR-004) |
| `attempt_service.py` | SQLite attempt log + per-topic aggregates (ADR-005), also the source for `learning_context_service.py`'s planning input |
| `learning_context_service.py`, `session_planner.py`, `constraint_resolver.py`, `content_repository.py`, `question_selector.py`, `session_planning_pipeline.py` | Learning Session Engine, stateless planning half (ADR-006/C1) |
| `session_store.py`, `session_builder.py`, `runtime_session_manager.py` | Learning Session Engine, stateful runtime half (ADR-007/C2) |

**REST surface** (all under `/api/v1`): `health`, `chapters` (+ `/questions`, `/topics` sub-resources), `topics/{id}`, `questions/{id}/answer` (the standalone, session-free evaluation route — never removed, still open with no auth), `auth/{teacher,student}/*`, `performance/me`, `sessions` (+ `current-question`, `answer`, summary). Full request/response shapes: `HANDOFF_PROMPT.md`'s equivalent section from the prior checkpoint, or read the route files directly — they're thin and self-documenting.

---

## 5. Frontend overview

**Pages** (`src/pages/`), by the two parallel practice systems that coexist deliberately (see §12):

*Anonymous track:* `HomePage`, `ChapterSelectionPage`, `ChapterPage`, `TopicPage`, `QuestionPage` (localStorage progress, full question bank, no login).

*Authenticated track:* `TeacherAuthPage`, `StudentJoinPage`, `DashboardPage`, `StartPracticePage`, `SessionQuestionPage` (server-tracked, session-scoped subset of questions), all four gated by `RequireStudent` where applicable.

*Shared / new in 0.1.2:* `NotFoundPage` (catch-all 404).

**Components** (`src/components/`): `AnswerInput` (now a real `<form>`, submits on Enter), `AnswerFeedback` (new — the coaching message's own visual identity), `BackLink` (new — the one navigation pattern used everywhere), `HintPanel` (staged, numbered reveal), `QuestionProgress` (a bar + count, not the old 44-dot grid), `DifficultyBadge`, `SolutionPanel`, `ChapterCard` / `ChapterPerformanceCard` (anonymous vs. authenticated chapter tiles), `ResumeBanner`, `SessionCompleteSummary`, `SessionModeSelector`, `RequireStudent` (route guard, now with a genuine `unreachable` state distinct from `unauthorized` — see §12).

**Services** (`src/services/`) — the only place components touch the network or `localStorage`: `questionService`, `progressService`/`progressStore` (localStorage split), `authService`, `sessionService`, `sessionPointerService`/`sessionPointerStore` (resume-pointer localStorage split), `performanceService`.

---

## 6. Design system

New in Release 0.1.2, and the single most load-bearing addition for anyone doing frontend work from here on: **`src/styles/tokens.css`** is the one source of truth for typography, spacing, color, borders, radii, and shadows. `index.css` and `App.css` build on it; no other file should introduce a raw hex value or a one-off pixel spacing number.

Key conventions:
- **Spacing:** 4px base scale (`--space-1` through `--space-16`).
- **Colour:** one primary (`--color-primary`, `#7c3aed`), semantic success/retry/info/danger tokens, a neutral ramp. "Retry" (not-yet-correct) is deliberately amber, never red — a first wrong attempt is a normal coaching step, not an error.
- **Controls:** `--control-height: 44px` (WCAG 2.5.5 / Apple HIG minimum), enforced via the base `button`/`input` rules — but watch out, this rule also silently catches `<input type="radio">` unless scoped away (a real bug found and fixed this release — see `SessionModeSelector.css`'s comment).
- **Reading measure:** `--measure: 60ch`, chosen empirically (measured live at 64 characters/line, inside the 55–75 target — `68ch` was tried first and measured 76, too wide).
- **Layout:** `.container` (left-aligned content pages, top-justified) vs. `.container-hero` (centered, for short self-contained screens: home, auth, confirmations, 404). `.content-column` is the standard `max-width: 920px` reading column.
- **Navigation:** `BackLink` is the one pattern for "way back that isn't browser history." Its spacing settles into three consistent values by page family (8px content-column pages, 12px hero pages, 16px flat-list pages) — see `UX-Polish-Release-0.1.2-RC.md` §4 if you need the reasoning; don't add a fourth value without understanding why those three exist.

---

## 7. Authentication / session model

Minimal, deliberately (ADR-004): teacher accounts are email/password (bcrypt); a class is a teacher-owned join code; a student is identified by *(join code + display name + 4-digit PIN)* — no student email or password anywhere. Session is an HTTP-only, signed cookie via Starlette's `SessionMiddleware`. Cross-site cookie config (`SESSION_COOKIE_SAMESITE=none` + `SESSION_HTTPS_ONLY=true`) is required for the current split-hosting deployment shape and is already set correctly in production (fixed in an earlier release, commit `d4445f5` — see `Deployment-Guide.md`).

**`RequireStudent`** (frontend route guard) now has four states, not two — this is a Release 0.1.2 fix, worth understanding before touching auth-adjacent frontend code: `checking` → `authorized` | `unauthorized` (redirects to `/student/join`) | `unreachable` (server error, offers Try Again + Go Home, **does not** redirect to the join form — a network failure is not "not logged in," and conflating the two used to leave every guarded page as a permanent blank loading screen).

**Teacher session restore:** `TeacherAuthPage` restores identity via `getCurrentUser()` on mount (fixed in a prior UX pass — it used to hold identity in React state only, so any refresh dropped a valid session back to the login form).

Known gaps, unchanged since ADR-004/005: no "list my classes" endpoint (a teacher who navigates away loses their join code permanently — the UI mitigates with a prominent, copy-button code display and an explicit warning, but doesn't solve it); no password-reset; no login rate-limiting; no length limit on any user-supplied name anywhere in the schema.

---

## 8. Topic/content pipeline

Content is authored offline in `docs/content-source/<chapter>/` — a staged trail (topic detection → concept extraction → learning objectives → worked examples → questions, roughly stages 2–6) with a `reviewStatus` field gating export (`"ai-generated"` by default, must be `"approved"` to export). A Stage 10 Export Pipeline (`docs/content-pipeline/export/`, run via `node run.js --chapter=<slug> [--dry-run]`) merges approved content into the real runtime `backend/app/data/*.json`, validating against actual backend Pydantic schemas and writing atomically per-chapter. Full detail: ADR-003.

**All six chapters are now content-complete** as of the Curriculum Expansion Milestone (`fbc7eed`, 2026-08-15 — see §17): Linear Equations (44 questions), Data Handling (42), Understanding Quadrilaterals (40, authored from scratch in Release 0.1.1 — the official NCERT PDF for this chapter turned out to be a scanned image with no extractable text layer, so it was authored directly from standard NCERT Class 8 Ch.3 curriculum knowledge instead, documented honestly in that chapter's `stage2-topic-detection.md` rather than fabricated as a literal extraction), **A Square and A Cube** (40, new chapter this milestone — NCERT's own current "Ganita Prakash" syllabus already merges Squares/Square Roots and Cubes/Cube Roots into this one chapter, confirming the merge wasn't invented), **Rational Numbers** (expanded 5→40 this milestone, Topic replaced with a 5-section explanation), **Practical Geometry** (expanded 5→35 this milestone, **deliberately still has no Topic/Learn page** — see below).

Practical Geometry's export doesn't go through the normal Stage 10 `run.js`: the pipeline has no code path to resolve a `chapterId` for questions without a Topic to anchor it, so a dedicated topic-less path (`docs/content-pipeline/export/run-topicless.js`) is used instead — it reuses the pipeline's real approval-gate (`applyApprovalGate`) and transform/validate/merge modules, but not `loadCanonical()`'s structural loader (that loader's `requireFields()` rejects `topicId: null`, which is exactly the value this chapter's content-source files use to mean "genuinely no Topic"). This is tracked architectural debt, not a hidden feature of the normal pipeline — don't assume `run.js` alone can onboard a topic-less chapter.

**A known, permanent limitation:** the export pipeline's `transformTopic` function joins each authored section's `body` text but **drops the section `title`** — so the runtime `Topic.explanation` field is one opaque string. The frontend (`TopicPage.tsx`) recovers *paragraph* structure by splitting on blank lines, but cannot recover section *headings* without a schema change. Documented in that file's own comments. This is real, deferred Phase 1 work (§13.4).

---

## 9. ADR summary

Seven accepted ADRs, all implemented and verified against shipped code (`docs/ADR/`):

| ADR | Decision |
|---|---|
| 001 | Evaluation/coaching separation — `answer_service` is a thin orchestrator over two independent collaborators |
| 002 | Shadow Mode execution and logging — out-of-band AI evaluator, zero production behavior change |
| 003 | Content authoring and export pipeline — see §8 |
| 004 | Student/teacher identity — see §7 |
| 005 | Server-side attempt history — SQLite, `BackgroundTasks`-recorded, ordering-sensitive (see §12) |
| 006 | Learning Session planning architecture — the stateless half of session creation |
| 007 | Learning Session runtime architecture — the stateful half (session persistence, question serving, answer submission) |

---

## 10. Current feature set

Everything a student, teacher, or anonymous visitor can currently do:

- **Anonymous:** browse all 6 chapters, read a Topic/Learn page (5 of 6 chapters have one — Practical Geometry intentionally doesn't, see §8), work through the full question bank per chapter with progressive hints and rule-based evaluation, progress tracked in `localStorage` only.
- **Student (authenticated):** join a class via code, see a Dashboard with real per-topic performance (attempts, accuracy, mastered flag) pulled from server-recorded history, start a configured session (Practice / Revision / Test mode, difficulty filter, question count, time limit for Test), work through it one question at a time with server-persisted state, resume an abandoned session via a Dashboard banner, complete a session (score shown only in Test mode).
- **Teacher (authenticated):** register/login, create a class, get a join code (shown once, no way to retrieve it later — see §7).
- **Navigation:** every screen has an explicit way out that isn't the browser Back button (Release 0.1.2's headline UX work); a catch-all 404 page for any bad URL; recoverable error states everywhere the backend might be unreachable.

---

## 11. Testing strategy

**Backend:** pytest + `TestClient`, one file per module, **205/205 passing**. Auth-adjacent test files share a module-level `TestClient` and clear its cookie jar before every test. Learning Session Engine's C1 tests are pure functions with no HTTP layer and include a real invariant check (`session_planner.py`'s test parses its own source as an AST to enforce "never imports content-access modules"). **Anything involving `BackgroundTasks` needs a live check, not just green tests** — a real ordering bug (attempt recording queued behind Shadow Mode's slow AI call) passed a fully green test suite because the test fixture stubs that call to be instant; only live verification caught it.

**Frontend:** Vitest + Testing Library, **112/112 passing** (21 files), `tests/` mirrors `src/` 1:1 for components and services. **No page-level tests exist anywhere in this repo, by established convention** — page behavior is verified via live browser walkthrough every time, not unit tests. Before calling anything done: `tsc -b` + `oxlint` + `vitest run`, then a live walkthrough with both servers running.

**A hard limitation you will hit immediately:** the Browser pane in this development environment does not reliably composite frames for screenshot capture — every `screenshot` call has timed out across multiple sessions. Verification in this project has been done via DOM geometry (`getBoundingClientRect`), computed styles, and behavioral walkthrough (clicking, reading rendered text) instead — which is rigorous for correctness but blind to aesthetics. **Nobody has visually confirmed this app looks right on a real screen.** If you get a working screenshot tool, use it before claiming any visual work is done.

---

## 12. Known technical debt

1. **Exact-string-match evaluation is brittle.** `evaluation_service.evaluate()` does `submission.answer.strip() == expected_answer.strip()` — nothing fuzzier. This is a known, documented, *accepted* limitation (see `linear-equations/answer-keys.json`'s own note), not a bug to silently fix. A user confirmed a fresh instance of it in production during Release 0.1.2 (an answer like "360 degree" not matching) and separately suggested some questions would work better as multiple-choice — both logged as deferred (§13.5/13.6), not fixed, because fixing either means backend/schema work outside a frontend-only release's scope.
2. **The two practice systems (anonymous `/question/:id` vs. authenticated `/session/:id`) are structurally independent** — different components, different progress models (`localStorage` vs. server), a real duplication risk if one gets a fix the other doesn't. Release 0.1.2 already caught and fixed exactly this: the session flow's "Reveal Solution" button was gated on a server flag the anonymous flow never depended on, creating a dead end the anonymous flow was structurally immune to. **When you fix something in one question flow, check the other one too.**
3. **`coaching_service.decide()` is a pure function of `(is_correct, attempt_number)` only** — it has no concept of hint usage. This is fine as a coaching-message driver, but don't reuse `canRevealSolution` as a proxy for "has the student exhausted their scaffolding" anywhere else in the frontend; it isn't that.
4. **No teacher-facing value beyond "create a class."** No roster, no class-wide progress view, no way to see or recover a lost join code. This is a real, acknowledged gap, not an oversight — a full teacher dashboard is unscoped Phase 1/2 work.
5. **`--control-height: 44px` on the base `input` rule silently catches every `<input>` type**, including radio/checkbox, unless explicitly scoped away. Found and fixed once (`SessionModeSelector.css`) — if you add any new radio/checkbox input anywhere, check it isn't rendering as a 44px invisible box.
6. **Rational Numbers was an undocumented Learning Session Engine test fixture.** Discovered during the Curriculum Expansion Milestone: 9 backend test files across the Learning Session Engine, evaluation, and Shadow Mode suites relied on Rational Numbers staying small (5 questions) and difficulty-sparse (zero Hard questions) — not because those tests were *about* Rational Numbers, but because it happened to be a convenient small chapter. Expanding it to 40 questions broke 45 tests on stale assumptions baked into fixtures, not test logic. All were updated to match the new content shape (not weakened — see that milestone's pre-commit audit). **This is a standing risk for any future chapter expansion**: any chapter's content shape may be silently load-bearing for tests that aren't about that chapter. No chapter is currently "safe by construction" for this — worth a dedicated synthetic fixture chapter for the Learning Session Engine's own tests at some point, not scoped or built yet.

---

## 13. Deferred Phase 1 items

In priority order, roughly by user impact:

1. **Backend `max_length` on user-supplied names** (`displayName`, class name, teacher name) — the frontend is now robust to any length via CSS, but the real fix is schema-level.
2. **A "list my classes" endpoint** — new API route, so genuinely Phase 1, not a polish-pass fix.
3. **Session page `<h1>` says "Practice session" in every mode, including Test** — small, but touches load sequencing (the mode isn't known until the summary call resolves), so do it deliberately.
4. **Topic explanation loses section headings in the export pipeline** — `transformTopic` needs to stop dropping `section.title`; likely a small, additive schema change (`Topic.explanation` from `str` to a list of `{title, body}`), but touches the runtime schema and the frontend consumer together.
5. **Answer-matching brittleness** — scope whether/how to move toward fuzzy matching or multiple-choice for the questions where exact-match genuinely doesn't work (see §12.1). This needs a content-format decision first, then whatever schema/evaluation change follows from it.
6. **A real teacher dashboard** — roster, class-wide progress, the actual value proposition beyond a join code. Currently the single biggest gap between "student tool" and "school-ready product."

---

## 14. Recommended implementation order

If picking up fresh work rather than continuing a specific thread:

1. **§13.1 (name length limits)** — smallest, safest, closes a real (if low-severity) gap, good first PR to re-establish rhythm with this codebase.
2. **§13.4 (Topic section headings)** — self-contained, improves the Learn page meaningfully, good next step after the design system work already done.
3. **§13.2 (list-my-classes endpoint) + §13.6 (teacher dashboard)** — do these together; the endpoint without the dashboard using it is dead work, and the dashboard needs the endpoint to exist.
4. **§13.5 (answer-matching)** — do this last among the deferred items; it's the most architecturally significant (touches evaluation, possibly schema, possibly a new question-type concept) and deserves its own design pass, not a bolt-on.

Do not start any of these without a design/review/approval pass first — this project's own established workflow (§16) applies to Phase 1 exactly as it applied to every milestone before it.

---

## 15. Risks

- **Screenshot tooling.** Every visual claim across two consecutive UX passes and this finalization is backed by geometry/computed-style measurement, never an actual look. If the next environment also can't screenshot, this compounds — consider explicitly asking the user to eyeball the app before trusting any future "looks correct" claim.
- **The Vercel SPA-fallback gap** (found and fixed this release) suggests deployment configuration isn't as fully verified as the documentation implies. Before trusting any other platform-specific claim in `Deployment-Guide.md`, verify it against the live URL rather than the doc.
- **Local dev data collisions.** `backend/app/data/{teachers,classes,students}.json` and `runtime.db` are gitignored but shared across whoever is running the local dev server — multiple sessions (agent + human) working against the same local backend at once can silently overwrite each other's in-progress test data. Not a production risk, but worth knowing before assuming a "clean" local state.
- **The two-practice-system duplication** (§12.2) is a standing structural risk for every future question-flow change, not a one-time gotcha.

---

## 16. Coding standards

- Ask before assuming when a spec conflicts with existing architecture — stop and clarify, don't guess.
- Minimal, focused diffs. Don't refactor unrelated code. Don't rename/move files unless asked.
- No new dependencies or top-level folders without justification and approval.
- Routes/components stay thin; business logic lives in services — followed with zero exceptions so far, both sides.
- Python: Pydantic models for every request/response shape, `response_model=` on every route, plain function modules (not classes) for services.
- TypeScript: strongly typed, plain function modules exported as one object literal (`export const xService = {...}`), not classes.
- No comments explaining *what* code does — only genuinely non-obvious constraints (a hidden invariant, a workaround, something that would surprise a reader).
- Commit messages: Conventional Commits. Only commit when explicitly asked, only after tests are green.
- **Workflow: Design → Review → Approval → Small implementation slices, each independently testable → Tests with every slice → Documentation after implementation → Final verification (re-run tests fresh, live-verify anything UI-observable) before calling anything done.** Don't skip steps 1–3 by jumping to implementation on a request that reads like a spec.

---

## 17. Release history

| Release | What shipped |
|---|---|
| 0.1 ("It Remembers You") | Progress persistence layer, Chapter Overview & Continue Learning |
| 0.2, first slice | Topic data model, Template Engine v1, content authoring pipeline, Stage 10 Export — Linear Equations migrated end-to-end |
| Scalable Assessment System, Milestones A–C2 | Student/teacher identity, server-side attempt history, Learning Session Engine (planning + runtime) |
| Milestone F1 / RC1 | Session Frontend (Dashboard → Configuration → Creation → Question → Coaching → Completion → Resume), deployment readiness |
| v1.0.0-rc1 → production | Split deployment live on Vercel + Render |
| Cross-site cookie fix (`d4445f5`) | Fixed `SESSION_COOKIE_SAMESITE`/`SESSION_HTTPS_ONLY` for the split-hosting shape — teacher login was silently broken (401 on the very next authenticated call) until this shipped |
| **0.1.1** (folded into 0.1.2's commit, never shipped standalone) | Data Handling + Understanding Quadrilaterals fully authored/exported (5→42, 5→40 questions) |
| **0.1.2** (`c414563`/`22fdcb0`/`a16788e`) | Frontend UX overhaul, production-readiness audit fixes, Vercel SPA-fallback fix, session hint/reveal-solution dead-end fix |
| **Curriculum Expansion Milestone** (this handoff update's release, `fbc7eed`) | New chapter A Square and A Cube (40 questions, full Topic/Learn); Rational Numbers expanded 5→40 questions with a replaced 5-section Topic; Practical Geometry expanded 5→35 questions via the topic-less export path, still no Topic by design. 12 backend test files updated for Rational Numbers' content-shape change (question/topic ids, difficulty distribution — see §12.6). No frontend, evaluation, or session-architecture changes. |

---

## 18. Current production state

| | |
|---|---|
| Frontend | https://math-thinking-coach-zeta.vercel.app/ (Vercel project renamed from `builder-workspace` to `math-thinking-coach` on 2026-08-07; old URL `builder-workspace-zeta.vercel.app` now 404s — do not use) |
| Backend | https://math-thinking-coach-api.onrender.com |
| Latest commit live | `fbc7eed` (Curriculum Expansion Milestone — pushed and deployed 2026-08-15) |
| Backend health | confirmed healthy post-deploy; content confirmed live via direct API calls — 6 chapters, per-chapter question counts 44/42/40/40/40/35 (linear-equations/data-handling/understanding-quadrilaterals/squares-and-cubes/rational-numbers/practical-geometry), all matching the export exactly |
| Frontend health | confirmed — chapter list shows all 6 chapters including "A Square and A Cube"; A Square and A Cube's chapter page (0 of 40), Learn page (full 4-section content), and first question all verified live, including a real answer submission (`225` for "What is 15 squared?") producing the correct coaching response and advancing; Rational Numbers' chapter page (0 of 40) and expanded 5-section Learn page confirmed live; Practical Geometry's chapter page (0 of 35) and Practice (question 1 of 35) confirmed live with no broken Learn link — it correctly shows "Start Learning" straight into Practice, same topic-less behavior as before this milestone, just with more questions |
| Known live issue at time of writing | none found during this milestone's verification |
| Test/throwaway accounts in production | one teacher + one class created by the user for smoke testing (join code `A996AX` at time of writing) — still not cleaned up, since I don't have production database access; carried over from the prior handoff, unrelated to this milestone |

---

## 19. Suggested first task for the next chat

**Do not start new feature work without asking the user what they want first** — this has been the standing rule at every checkpoint in this project's history, and Phase 1 doesn't change that.

If the user's first message doesn't specify, the single most useful thing to do is:

1. Run `git status` and `git log --oneline -5` to confirm this document isn't stale.
2. Re-run backend `pytest` and frontend `vitest run` fresh — confirm 205/112 still holds.
3. Confirm the Curriculum Expansion Milestone (`fbc7eed`) is actually live in production, per §18 — this document's own §18 may still show a deployment gap if the push/deploy decision from that milestone's closure wasn't resolved before this was written.
4. Then ask what they want to work on. The Product Architect has flagged a pending decision between two candidate next milestones — **(A) Structured Learning Content / Topic schema improvements** vs. **(B) Answer Evaluation v2 / mathematical answer semantics** — neither approved yet; don't start either without an explicit go-ahead. §14's deferred-item order is still the fallback menu if nothing else is specified.
