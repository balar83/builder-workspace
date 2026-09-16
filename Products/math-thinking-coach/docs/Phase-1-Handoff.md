# Math Thinking Coach — Phase 1 Handoff

**Written:** 2026-08-07, immediately after Release 0.1.2 shipped to production.
**Updated:** 2026-08-15, after the Curriculum Expansion Milestone (commit `fbc7eed`) — see §8, §10, §17.
**Updated:** 2026-08-17, after Slice A1 (Structured Learning Content Foundation) closed and deployed (commit `6285263`) — see §8, §13.4, §17, §18.
**Updated:** 2026-08-19, after M2.1–M2.4 (Question Response Semantics, `e41670a`/`87e8414`/`e120a1d`/`2e0205d`) and the Squares & Cubes content import (`a071335`) closed and deployed, and after the M2 Documentation & Architecture Reconciliation — see §9, §11, §17, §18.
**Updated:** 2026-09-02, after the content expansion to 420 questions across 7 chapters (`112ace7`), the chapter lesson-page UX slice (`44b98b7`), and the Product Strategy Documentation Alignment reset (`Product-Vision.md`/`LearningExperienceArchitecture.md`/`Roadmap.md`/`README.md` rewritten to a new North Star — no application code changed in this pass) — see §1, §10, §12.2, §17, §18, §19.
**Updated:** 2026-09-16, after Self-Serve Learning Loop V1 Slices 1–6b + hardening (`2335c8a`…`8187e98`, 9 commits, 2026-09-03 to 2026-09-09, backfilled into this update since none had a prior handoff/journal entry) and this same day's release of Self-Serve continuation, M3 (`multi_part`, exactly `le-q25`/`le-q37`/`le-q40`), D1 (concept-level performance, new), and telemetry/mastery activation (`hintsUsed` now real, `submitted_option_id` persisted, hint-assisted correct answers no longer advance the mastery streak — an explicit, present-dated product decision). See `PROJECT_STATUS.md`'s "Engineering Milestone" and `Development-Journal.md`'s 2026-09-16 entries for full detail; not otherwise reflected in this document's numbered sections below in this pass.
**Purpose:** let a brand-new Claude conversation continue this project with zero context loss. Read this document fully before touching code. Where anything here conflicts with what you observe in the repository, **trust the repository** — this document describes a snapshot, not a live source of truth.

---

## 1. Product vision

**Superseded pointer (2026-09-02):** the authoritative North Star is now in `Product-Vision.md` — read it first. Summary: Math Thinking Coach is becoming an intelligent mathematics learning and assessment platform on **one common engine** (Learner → Content → Attempt → Evidence → Intervention → Assessment → Result), serving self-directed, teacher/parent, and institutional/class contexts alike — not an anonymous-only learning app and not a teacher/classroom product. It is not defined as either in isolation. The paragraph below is retained as accurate history of Phase 1's framing, not current product definition.

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

**REST surface** (all under `/api/v1`): `health`, `chapters` (+ `/questions`, `/topics` sub-resources), `topics/{id}`, `questions/{id}/answer` (the standalone, session-free evaluation route — never removed, still open with no auth), `auth/{teacher,student}/*`, `performance/me`, `sessions` (+ `current-question`, `answer`, summary). Full request/response shapes: read the route files directly — they're thin and self-documenting.

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

**Resolved as of commits `51a05fe`/`d7890cc` (between 2026-08-19 and 2026-09-02) — corrected here, since this paragraph was stale and directly contradicted the shipped state.** The limitation described below (opaque `Topic.explanation` string, no real section headings) is Slice A1/A2-era history, not current reality: **Slice A2 has shipped.** `TopicPage.tsx` now renders `topic.concepts` directly (`isStructured = topic.concepts.length > 0`, with the legacy paragraph-splitting path kept only as a fallback for a topic with zero concepts — none exist today). **All 6 Topic-bearing chapters** (Squares and Cubes, Rational Numbers, Linear Equations, Data Handling, Understanding Quadrilaterals, Exponents and Powers) carry structured `Topic.concepts` — confirmed 2026-09-02 by reading `backend/app/data/topics.json` directly (3–5 concepts per chapter). This means **A2b (migrating the remaining chapters) is also done**, not a future item — Rational Numbers was the final chapter (`d7890cc`, "A2b-4"). Slice A3 (removing the now-unused legacy `explanation`/`workedExampleContent`/`learningObjectives` fields) has **not** been done — those fields are presumably still populated alongside `concepts` for backward compatibility; verify against the schema/pipeline before assuming otherwise. `Structured-Learning-Content-Design-Proposal.md`'s own status line still says "A2 and A3 are approved in shape only; neither is scheduled or started" — **that line is now stale too** and should be corrected in that document directly if it's touched next, rather than trusted as written.

A **legacy-vs-structured migration-state discriminator** (`docs/content-pipeline/export/topicMigrationState.js`) now governs the whole pipeline: it inspects the canonical content itself (presence of `id`/`conceptId` fields) to decide whether a chapter's Topic is legacy or migrated, and both states remain fully re-exportable — re-running `node run.js --chapter=<slug>` works for every chapter today, migrated or not. A chapter that mixes legacy and structured pieces fails export loudly rather than being silently misclassified. This was a corrective fix during Slice A1 (the first pass had made structured ids globally mandatory, which would have blocked re-exporting any un-migrated chapter) — see the design doc §W.4 for the full account.

---

## 9. ADR summary

Eight accepted ADRs, all implemented and verified against shipped code (`docs/ADR/`):

| ADR | Decision |
|---|---|
| 001 | Evaluation/coaching separation — `answer_service` is a thin orchestrator over two independent collaborators |
| 002 | Shadow Mode execution and logging — out-of-band AI evaluator, zero production behavior change |
| 003 | Content authoring and export pipeline — see §8 |
| 004 | Student/teacher identity — see §7 |
| 005 | Server-side attempt history — SQLite, `BackgroundTasks`-recorded, ordering-sensitive (see §12) |
| 006 | Learning Session planning architecture — the stateless half of session creation |
| 007 | Learning Session runtime architecture — the stateful half (session persistence, question serving, answer submission) |
| 008 | Question/response evaluation architecture — `questionType`/`ResponseSpecification` on `Question`, the `Evaluator` protocol + registry dispatch (`short_text`/`numeric`/`single_choice`/`multi_choice`), and the same capability represented coherently across schema → evaluator → pipeline → UI (M2.1–M2.4, `e41670a`/`87e8414`/`e120a1d`/`2e0205d`) |

---

## 10. Current feature set

**Counts below updated 2026-09-02** (content expansion `112ace7`): 7 chapters, 420 questions (60 each), 6 of 7 have a Topic/Learn page (Practical Geometry still intentionally doesn't). See `README.md`'s "Current chapters" table, verified directly against `backend/app/data/*.json`.

Everything a student, teacher, or anonymous visitor can currently do:

- **Anonymous:** browse all 7 chapters, read a Topic/Learn page (TopicPage — 6 of 7 chapters have one, see §8), including a top-of-page "Start Practice" shortcut CTA and progressive-disclosure worked examples added in the 2026-09-02 UX slice (`44b98b7`), work through the full question bank per chapter with progressive hints and rule-based evaluation, progress tracked in `localStorage` only.
- **Student (authenticated):** join a class via code, see a Dashboard with real per-topic performance (attempts, accuracy, mastered flag) pulled from server-recorded history, start a configured session (Practice / Revision / Test mode, difficulty filter, question count, time limit for Test), work through it one question at a time with server-persisted state, resume an abandoned session via a Dashboard banner, complete a session (score shown only in Test mode).
- **Teacher (authenticated):** register/login, create a class, get a join code (shown once, no way to retrieve it later — see §7).
- **Navigation:** every screen has an explicit way out that isn't the browser Back button (Release 0.1.2's headline UX work); a catch-all 404 page for any bad URL; recoverable error states everywhere the backend might be unreachable.

---

## 11. Testing strategy

**Backend:** pytest + `TestClient`, one file per module, **267/267 passing** (205/205 at this document's prior update — Slice A1 added 14, M2.1–M2.4 added 48 more across the evaluator registry and three new evaluators). Auth-adjacent test files share a module-level `TestClient` and clear its cookie jar before every test. Learning Session Engine's C1 tests are pure functions with no HTTP layer and include a real invariant check (`session_planner.py`'s test parses its own source as an AST to enforce "never imports content-access modules"). **Anything involving `BackgroundTasks` needs a live check, not just green tests** — a real ordering bug (attempt recording queued behind Shadow Mode's slow AI call) passed a fully green test suite because the test fixture stubs that call to be instant; only live verification caught it.

**Frontend:** Vitest + Testing Library, **134/134 passing** (112/112 at this document's prior update — M2.2/M2.3 added the `SingleChoiceInput`/`MultiChoiceInput`/`QuestionResponseInput` component suites), `tests/` mirrors `src/` 1:1 for components and services. Stage 10 pipeline JS tests: **88/88 passing**, not covered by the counts above. **No page-level tests exist anywhere in this repo, by established convention** — page behavior is verified via live browser walkthrough every time, not unit tests. Before calling anything done: `tsc -b` + `oxlint` + `vitest run`, then a live walkthrough with both servers running.

**A hard limitation you will hit immediately:** the Browser pane in this development environment does not reliably composite frames for screenshot capture — every `screenshot` call has timed out across multiple sessions. Verification in this project has been done via DOM geometry (`getBoundingClientRect`), computed styles, and behavioral walkthrough (clicking, reading rendered text) instead — which is rigorous for correctness but blind to aesthetics. **Nobody has visually confirmed this app looks right on a real screen.** If you get a working screenshot tool, use it before claiming any visual work is done.

---

## 12. Known technical debt

1. **Exact-string-match evaluation is brittle.** `evaluation_service.evaluate()` does `submission.answer.strip() == expected_answer.strip()` — nothing fuzzier. This is a known, documented, *accepted* limitation (see `linear-equations/answer-keys.json`'s own note), not a bug to silently fix. A user confirmed a fresh instance of it in production during Release 0.1.2 (an answer like "360 degree" not matching) and separately suggested some questions would work better as multiple-choice — both logged as deferred (§13.5/13.6), not fixed, because fixing either means backend/schema work outside a frontend-only release's scope.
2. **The two practice systems (anonymous `/question/:id` vs. authenticated `/session/:id`) are structurally independent** — different components, different progress models (`localStorage` vs. server), a real duplication risk if one gets a fix the other doesn't. Release 0.1.2 already caught and fixed exactly this: the session flow's "Reveal Solution" button was gated on a server flag the anonymous flow never depended on, creating a dead end the anonymous flow was structurally immune to. **When you fix something in one question flow, check the other one too.**

   **Updated framing (2026-09-02):** this is no longer just a maintenance risk to manage indefinitely — it is now the concrete technical shape of the gap between current architecture and the agreed North Star target (`Product-Vision.md`'s Common Product Model: one Learner→Content→Attempt→Evidence→Intervention→Assessment→Result engine, not two). See `ProductArchitecture.md` §1a for the current-vs-target comparison table, and `Roadmap.md`'s North Star Capability Model, "Blocked on a product-owner decision," for why closing it (unifying onto the more-capable authenticated-track engine, extended to not require a class) is the single highest-leverage architectural item and is explicitly not yet authorized to start.
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
4. **~~Topic explanation loses section headings on the Learn page~~ — resolved.** Slice A2 (`TopicPage.tsx` consuming `topic.concepts`) and A2b (migrating all remaining Topic-bearing chapters) have both shipped as of `51a05fe`/`d7890cc` — see §8's corrected note. Only Slice A3 (removing the now-redundant legacy fields) remains, and it's low-priority cleanup, not a user-facing gap.
5. **Answer-matching brittleness** — scope whether/how to move toward fuzzy matching or multiple-choice for the questions where exact-match genuinely doesn't work (see §12.1). This needs a content-format decision first, then whatever schema/evaluation change follows from it.
6. **A real teacher dashboard** — roster, class-wide progress, the actual value proposition beyond a join code. Currently the single biggest gap between "student tool" and "school-ready product."

---

## 14. Recommended implementation order

If picking up fresh work rather than continuing a specific thread:

1. **§13.1 (name length limits)** — smallest, safest, closes a real (if low-severity) gap, good first PR to re-establish rhythm with this codebase.
2. ~~§13.4 (Topic section headings)~~ — **done**, see §8/§13.4's corrected note; no longer a candidate here.
3. **§13.2 (list-my-classes endpoint) + §13.6 (teacher dashboard)** — do these together; the endpoint without the dashboard using it is dead work, and the dashboard needs the endpoint to exist.
4. **§13.5 (answer-matching)** — do this last among the deferred items; it's the most architecturally significant (touches evaluation, possibly schema, possibly a new question-type concept) and deserves its own design pass, not a bolt-on.

Per `Roadmap.md`'s North Star Capability Model (2026-09-02), the item now ranked above all of these for leverage-per-effort is exposing the already-authored misconception fields (§8/`ProductArchitecture.md` §7) — not in this numbered list because it predates that model; check `Roadmap.md` before defaulting to this list.

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
| **Slice A1 — Structured Learning Content Foundation** (`6285263`, 2026-08-17) | Additive `Topic.concepts`/`.workedExamples` (structured `Concept`/`LearningObjective`/`WorkedExample`) and `Question.objectiveIds`, alongside unchanged legacy fields. Stage 10 export pipeline gained a legacy-vs-structured migration-state discriminator so every chapter stays re-exportable through the migration window. A Square and A Cube migrated as the pilot (only chapter with structured content); the other 4 Topic-bearing chapters and Practical Geometry are unaffected. No frontend, evaluation, coaching, or Learning Session Engine changes — confirmed by empty diff and full test suite (219 backend, 112 frontend, 47 new pipeline tests, all green). Full record: `Structured-Learning-Content-Design-Proposal.md` §W. Slices A2 (frontend cutover) and A3 (legacy field removal) are approved in shape only, not started. |
| **M2.1–M2.3 — Question Response Semantics** (`e41670a`/`87e8414`/`e120a1d`, 2026-08-17) | `questionType`/`ResponseSpecification` added additively to `Question`; `Evaluator` protocol + registry dispatch in `evaluation_service.py`; `numeric_tolerance_v1`, `single_choice_v1`, `multi_choice_v1` evaluators alongside the extracted `short_text_v1`; Stage 10 structural validation; frontend `QuestionResponseInput` dispatch + `SingleChoiceInput`/`MultiChoiceInput`. A capability slice — zero production content used any of the new types until M2.4. Full record: `Question-Response-Semantics-Design-Proposal.md` (Parts I and II). Architecture: [ADR-008](ADR/ADR-008-question-response-evaluation-architecture.md). |
| **M2.4 — Content Activation Pilot: Linear Equations** (`2e0205d`, 2026-08-17) | Real content converted to the M2.1–M2.3 types for the first time: Linear Equations → 3 single_choice/2 multi_choice/28 numeric/11 short_text (44 questions, difficulty split unchanged). Content-only — no evaluator/schema/coaching/session-engine/frontend source file touched. 267/267 backend, 88/88 Stage 10 pipeline, 134/134 frontend. The `numeric` pilot landed here rather than the originally-proposed Squares and Cubes — see `Question-Response-Semantics-Design-Proposal.md`'s pilot-chapter reconciliation note. |
| **Content import — Squares and Cubes test questions** (`a071335`, 2026-08-19) | Squares and Cubes expanded 40 → 52 questions via the existing Stage 10 pipeline. Content-only, unrelated to M2's evaluator work. |
| **M2 Documentation Reconciliation + A2/A2b Structured Content Migration** (`51a05fe`, between 2026-08-19 and 2026-09-02 — exact date not recorded when this row was backfilled 2026-09-02) | Slice A2 (`TopicPage.tsx` cut over to render `topic.concepts` directly, legacy paragraph-splitting kept only as a fallback) and the start of A2b (migrating Linear Equations, Data Handling, Understanding Quadrilaterals onto structured `Topic.concepts`). **This row and the next were missing from this table until backfilled 2026-09-02** — found by reading `git log` and `backend/app/data/topics.json` directly after this file's own §8 was discovered to be stale; see §8's corrected note. |
| **A2b-4 — Rational Numbers Structured Content Migration (final chapter)** (`d7890cc`, between 2026-08-19 and 2026-09-02) | Rational Numbers migrated onto structured `Topic.concepts`, completing A2b — all 6 Topic-bearing chapters now carry structured content. |
| **Content expansion — Exponents and Powers + 6 chapters to 420 total** (`112ace7`, 2026-09-02) | New chapter Exponents and Powers added; all 7 chapters normalized to 60 questions each (420 total, up from 253). Content-only, via the existing Stage 10 pipeline (topic-less path for Practical Geometry, as before). |
| **Chapter lesson-page UX slice** (`44b98b7`, 2026-09-02) | TopicPage: top-of-page "Start Practice" shortcut CTA (alongside the unchanged end-of-lesson one) + progressive-disclosure worked examples (native `<details>/<summary>`, first example per page open by default). Minimal regression test added (`frontend/tests/pages/TopicPage.test.tsx`). Explicitly scoped to exclude self-serve access changes, Revision/Review-incorrect features, teacher dashboard, GenAI, agents, and a full E2E framework. |
| **Product Strategy Documentation Alignment** (2026-09-02, no commit yet — documentation only) | `Product-Vision.md`, `LearningExperienceArchitecture.md`, `Roadmap.md`, `ProductArchitecture.md`, `README.md`, this file rewritten/updated to a newly agreed North Star (one common engine; assessment not inherently teacher-only; mastery/fluency/transfer/readiness and the "twist"/transfer taxonomy as explicit future direction; deterministic-first GenAI strategy with 5 named future use cases; explicit non-goals). No application/product code, schema, API, UI, or content changed in this pass — see `Roadmap.md`'s North Star Capability Model for the resulting current-vs-target plan. |

---

## 18. Current production state

**Updated 2026-09-02** — the row-level detail below (Backend/Frontend health, known issues, test accounts) is carried over unverified from the 2026-08-19 update and is now stale; re-verify before trusting it. What's confirmed as of this update: `backend/app/data/{chapters,questions,topics}.json` on disk hold 7 chapters, 420 questions (60 each), 6 Topics (all but Practical Geometry) — read directly, not from memory. Backend `pytest` (304/304) and frontend `vitest run` (152/152) re-run fresh and confirmed passing 2026-09-02.

| | |
|---|---|
| Frontend | https://math-thinking-coach-zeta.vercel.app/ (Vercel project renamed from `builder-workspace` to `math-thinking-coach` on 2026-08-07; old URL `builder-workspace-zeta.vercel.app` now 404s — do not use) |
| Backend | https://math-thinking-coach-api.onrender.com |
| Latest commit live | Not independently re-verified this update — `112ace7` (content expansion) and `44b98b7` (TopicPage UX slice) are the latest commits in the repo as of 2026-09-02; confirm against the live deployment before relying on this. Prior confirmed-live commit: `a071335`, 2026-08-19. |
| Backend health | **Not re-verified this update** — last confirmed healthy at M2.4/content-import close (2026-08-19), when all 6 then-existing chapters were live with question counts 44/42/40/35/40/52 = 253 total. Re-check `/api/v1/health` and per-chapter counts before trusting production reflects the 7-chapter/420-question state confirmed locally above. |
| Frontend health | **Not re-verified this update** — last confirmed at M2.4's close (2026-08-19). Re-check that all 7 chapters and the new UX-slice CTA/progressive-disclosure behavior are actually live before trusting this. |
| Known live issue at time of writing | Not re-verified this update. |
| Test/throwaway accounts in production | Not re-verified this update — one teacher + one class existed as of the 2026-08-19 update (join code `A996AX` at that time), still not cleaned up as far as is known. |

---

## 19. Suggested first task for the next chat

**Do not start new feature work without asking the user what they want first** — this has been the standing rule at every checkpoint in this project's history, and Phase 1 doesn't change that.

If the user's first message doesn't specify, the single most useful thing to do is:

1. Run `git status` and `git log --oneline -5` to confirm this document isn't stale.
2. Re-run backend `pytest` and frontend `vitest run` fresh — confirm 304/152 still holds as of 2026-09-02 (re-verified directly, see §18). Re-run the Stage 10 pipeline suite too; its 88-test count was not re-verified in this update.
3. Confirm `112ace7` (content expansion) and `44b98b7` (UX slice) are actually live in production — §18's health rows were **not** re-verified in the 2026-09-02 documentation-only update, only the local repo state was.
4. **Read `Product-Vision.md` and `Roadmap.md`'s North Star Capability Model first if the request touches product direction at all** — 2026-09-02 reset the strategic framing (one common engine, not two; assessment not inherently teacher-only; future direction for mastery/readiness/transfer and GenAI now documented) and superseded some prior framing in this file (see §1, §12.2). Then ask what they want to work on. Per `Roadmap.md`'s North Star Capability Model: the single highest-leverage, lowest-risk near-term item is exposing the already-authored `commonWrongAnswer`/`why`/`remediationHint` misconception fields through the pipeline + API (§8, `ProductArchitecture.md` §7) — no new content needed. The single largest gap is the two-engine split (§12.2), explicitly flagged "blocked on a product-owner decision," not yet authorized to start. **Slice A2 and A2b are already done** (§8) — do not re-propose them. §14's deferred Phase 1 items remain a fallback menu if none of the above is specified — **nothing past this reconciliation is scheduled or authorized to start** without an explicit go-ahead.
