# Implementation Journal — Milestone F1 (Student Learning Experience)

*Slice-by-slice implementation record for Milestone F1, per `Session-Frontend-Implementation-Plan.md`. Complements, not replaces, `Development-Journal.md` — this file tracks F1's slices specifically; a summary entry for each slice is also added to `Development-Journal.md`'s general engineering diary.*

---

## Sprint C — Complete Version 1.0 and Prepare RC1 (2026-07-29)

**Scope**: the three remaining pieces of `Sprint-C-Implementation-Plan.md` — Session Completion (C1), Resume (C2), Final UX Polish (C3) — plus a genuine deployment validation against a clean clone and the `v1.0.0-rc1` release notes entry. This closes out Milestone F1 (the Session Frontend) entirely; the full Dashboard → Configuration → Creation → Question → Coaching → Completion → Resume loop now works end to end.

### Files added
- `frontend/src/types/sessionPointer.ts` — `SessionPointer` (studentId, sessionId, chapterId, mode).
- `frontend/src/services/sessionPointerStore.ts` / `sessionPointerService.ts` — mirrors `progressStore.ts`/`progressService.ts`'s exact split, under a new, separate `localStorage` key (`mtc.session-pointer.v1`). `sessionPointerService.getActiveSessionFor(studentId)` scopes lookups to the current student (a shared-device safety check); `clearActiveSessionIfMatches(sessionId)` only clears a pointer that actually points at the session being cleared.
- `frontend/src/components/SessionCompleteSummary.tsx` + `.css` — the real, mode-aware Completion summary. Practice/Revision show a qualitative message only; Test mode is the one place a score renders.
- `frontend/src/components/ResumeBanner.tsx` + `.css` — the Dashboard's "Continue where you left off" prompt.
- Four new test files: `sessionPointerStore.test.ts`, `sessionPointerService.test.ts`, `SessionCompleteSummary.test.tsx`, `ResumeBanner.test.tsx`.

### Files modified
- `frontend/src/types/session.ts` — added `SessionSummaryResponse`/`SessionSummaryResult` (`GET /sessions/{id}`'s shape — the only place `mode` is available, since `SessionTerminalResponse` doesn't carry it).
- `frontend/src/services/sessionService.ts` — added `getSessionSummary()`.
- `frontend/src/pages/SessionQuestionPage.tsx` — the terminal branch now fetches the session summary (once, via a `[phase.kind, sessionId]`-scoped effect) and renders `SessionCompleteSummary`; the same effect clears the resume pointer via `clearActiveSessionIfMatches`. Added `aria-live="polite"` to every dynamic status region (coaching message, submit error, shortfall notice, sync notice) — a real accessibility gap, not previously covered, closed the same way `HintPanel`/`SolutionPanel` already handled it.
- `frontend/src/pages/StartPracticePage.tsx` — writes the resume pointer immediately after a successful `POST /sessions`, using `authService.getCurrentUser()` for the student id (already an established pattern elsewhere in this codebase).
- `frontend/src/pages/DashboardPage.tsx` — resolves the resume pointer on load: confirms liveness via `getSessionSummary`, only shows `ResumeBanner` for a confirmed-live session belonging to the current student, and **safely clears a confirmed-stale pointer** (not-found or terminal) without ever touching a pointer on a transient network failure. Also added the "Log out" affordance this sprint's own walkthrough required (see Notable decisions).

### Tests added
- 21 new frontend tests. Full suite: **96/96 passing** (75 → 96). `tsc -b` and `oxlint` both clean. Backend untouched: **198/198 pytest**.

### Notable implementation decisions
- **Caught and fixed a real bug in my own draft before it shipped**: the terminal branch's `summaryError` fallback originally displayed a raw `correctCount`/`totalCount` even when the session's mode was unknown — directly contradicting "scores hidden by default." Fixed to show no score at all in that fallback, matching the reasoning already written in the surrounding comment.
- **Logout was missing entirely** — `authService.logout()` existed since Milestone A but no page ever called it. This sprint's own required walkthrough (`Login → ... → Logout`) is what surfaced this; added a small "Log out" link to `DashboardPage`, the only real "home base" for a logged-in student, wired to the existing service. Verified live that it actually invalidates the server-side session (a direct `/dashboard` visit afterward redirects to login), not just a client-side navigation.
- **Stale-pointer cleanup is deliberately conservative**: only a *confirmed* signal (the session summary call returning `not-found`, or returning a real terminal status) clears a pointer. A network error leaves it alone — discarding a potentially-still-valid pointer on a transient failure would be worse than occasionally showing a resume banner one extra time.

### Deployment Validation (using `Developer-Runbook.md`, as required by this sprint)

Performed for real, not assumed: cloned the repository fresh (`git clone`) into an unrelated directory and followed only the documented steps, finding and fixing two real gaps before re-validating clean:

1. **`python -m venv .venv` failed** on this machine — Windows' Microsoft Store app-execution alias shadows `python` with a non-functional stub even though a real 3.13.5 install exists. `py -m venv .venv` (the standard Python Launcher) works. Added to `Developer-Runbook.md` §2/§7/§8 and the Prerequisites table.
2. **`npm install` failed outright** on the clean clone with an unresolvable peer-dependency error — `@testing-library/react@^14` peer-depends on React 18; this project is on React 19. `--legacy-peer-deps` resolves it. This is a real, reproducible gap in every prior sprint's documented setup commands, not a one-off — fixed in `Developer-Runbook.md` (install step + a new troubleshooting entry) and `Deployment-Guide.md` (build command, the Vercel/Netlify/Cloudflare Pages install-command override, and the self-hosted update procedure — three separate places that all needed the same fix).

After both fixes, re-validated end to end from the same clean clone: backend venv + dependency install, `.env.example` copy (confirms last milestone's `.gitignore` fix actually works from a fresh clone, not just locally), backend and frontend dev servers both starting correctly, `runtime.db`/`teachers.json`/`classes.json`/`students.json` all auto-created with no init step (confirms §5's claim), the exact documented `curl` sequence (teacher register → create class → student join → create session) working verbatim, and all four test/build/lint commands passing (198 backend, 96 frontend, `tsc -b`, `oxlint`) — all in the fresh clone, not the working repo.

### Live verification (both servers running, working repo)

Full required walkthrough, in order: real student login → Dashboard (no resume banner, correct for a fresh student) → Start Practice (Test mode, Rational Numbers, 3 questions) → answered all three (one correct, one via the full TRY_AGAIN → SHOW_HINT → SHOW_SOLUTION path) → **Completion showed "You got 2 of 3"** (Test mode's one score-showing case) → Return to Dashboard → **performance correctly refreshed** ("5 attempted · 40% accuracy", matching real attempt-level aggregation) → started a second session (Linear Equations, Practice) → navigated away *before* answering anything → **Resume banner appeared** on Dashboard, correctly scoped to the right chapter → clicked Resume → **landed on the exact same first question** → fast-forwarded the session to terminal via direct API calls → reloaded Dashboard → **stale pointer cleared automatically, no banner** → manually planted a pointer belonging to a different student → confirmed no banner and the foreign pointer left untouched → **Logout** → confirmed a direct `/dashboard` revisit redirected to login (server-side invalidation, not just client-side). Mobile (375×812) and tablet (768×1024) both checked across Dashboard, configuration, question/coaching, and Completion screens — no overflow, no console errors anywhere in the entire walkthrough. Anonymous `/chapters` flow re-verified unaffected. All test data removed afterward.

### Definition of Done
- [x] Sprint C complete — Session Completion, Resume, and UX Polish (including the logout gap this sprint's own walkthrough surfaced) all implemented
- [x] End-to-end Version 1.0 experience complete and live-verified, including every required walkthrough step
- [x] Tests passing — 96/96 frontend, 198/198 backend
- [x] `tsc -b` / `oxlint` clean
- [x] Documentation updated — `Implementation-Journal.md` (this entry), `Developer-Runbook.md` and `Deployment-Guide.md` (two real setup bugs found and fixed via genuine clean-clone validation), `Release-Notes.md` (`v1.0.0-rc1` entry)
- [x] No console errors (live-verified across every screen)
- [x] Mobile and tablet layouts confirmed
- [x] Anonymous flow regression-checked, unaffected
- [ ] Commit — see this repository's `git log` for the resulting hash, recorded after commit

## Sprint B — Complete the Core Learning Loop (2026-07-29)

**Scope**: Question → Submit Answer → Evaluation → Coaching → Next Question, repeated to the final question. Covers the original plan's Slice 4 (question experience) and Slice 5 (coaching feedback) together, in one sprint. Session Completion, Resume, and polish are explicitly out of scope — the terminal state gets a deliberately minimal placeholder, not the real Completion screen.

Per this sprint's documentation policy, only this file is updated.

### Files modified
- `frontend/src/types/session.ts` — added `SubmitSessionAnswerRequest`/`Response` (reusing the existing `AnswerEvaluation`/`AnswerCoach`/`AnswerUiState` types from `types/answer.ts` rather than redefining them) and a `SubmitAnswerResult` discriminated union (`ok` / `stale` / `not-found`).
- `frontend/src/services/sessionService.ts` — added `submitSessionAnswer()`. Its `stale` case covers **both** of the backend's distinct 409 causes (stale position, already-terminal session) — `POST /answer`'s 409 body is a plain string message for either, unlike `GET current-question`'s structured `SessionTerminalResponse`, so both collapse into one client-side case whose recovery is identical either way: re-fetch `current-question` and let *that* response distinguish stale-but-live from truly terminal.
- `frontend/src/pages/SessionQuestionPage.tsx` — rewritten around a `Phase` union (`loading`/`load-error`/`not-found`/`terminal`/`question`) plus per-question ephemeral state (answer text, submit-in-flight flag, last feedback, hint index, solution-revealed flag, sync notice). `AnswerInput` is now fully wired to `submitSessionAnswer`; hint reveal (`HintPanel`) and solution reveal (`SolutionPanel`) are both enabled, reusing the exact components Sprint A left disabled/unrendered.
- `frontend/src/pages/SessionQuestionPage.css` — removed the now-dead `.session-answering-note` rule (Sprint A's "coming in the next update" placeholder, no longer rendered); added rules for the sync notice, submit error, and the two-button action row.
- `frontend/tests/services/sessionService.test.ts` — 4 new tests for `submitSessionAnswer`, including one that asserts the request body is exactly `{position, answer}` with no `attemptNumber` key.

### Tests added
- 4 new frontend tests. Full suite: **75/75 passing** (71 → 75). `tsc -b` and `oxlint` both clean. Backend untouched: **198/198 pytest**, re-run fresh.
- No new page-level test for `SessionQuestionPage` — same established convention as every prior slice; this page's behavior is verified live below, including states (mid-hint-reveal, post-solution-reveal, terminal) that would be expensive to fully cover any other way.

### Notable implementation decisions
- **The coaching state machine mirrors `coaching_service.decide()` exactly**, not the old standalone `QuestionPage.tsx`'s client-side gating: `ui.canRevealSolution` (server-derived from attempt count) is now the authoritative gate for the "Reveal Solution" button, not a local "all hints revealed" heuristic the old page used. The hint button and the solution button can appear together once eligible — a student who's reached attempt 3 can still peek at a remaining hint instead of jumping straight to the solution, both self-service, neither blocking the other.
- **`SHOW_SOLUTION` already advanced the session server-side by the time it's shown** (ADR-007's deliberate deviation) — confirmed live, not just read from the ADR: clicking "Next Question" after a solution reveal landed on the *next* question on the first try, with no extra click needed and no stale-position error. The UI reflects this by disabling `AnswerInput` (`ui.canTryAgain === false`) the instant that response comes back, before the student ever clicks anything else.
- **Duplicate-submission prevention has two independent layers**: an in-flight guard (`submitting` state, checked inside `handleSubmit` itself, not just via the button's `disabled` attribute) and the `ui.canTryAgain` lock once a question is server-side finished. Live-verified: a rapid double-click on "Check Answer" produced exactly one `POST /answer` request, confirmed via the network log, not just inferred from the code.
- **The terminal placeholder deliberately shows no score**, even though `SessionTerminalResponse.correctCount` is available and it's "just a placeholder." `SessionTerminalResponse` doesn't carry the session's `mode`, and "scores hidden by default" is a product principle that applies regardless of mode — showing a number here without knowing whether this was a Practice/Revision/Test session would risk violating that principle in exactly the cases it matters most (Practice, the default). The real, mode-aware summary is explicit future scope, not an oversight here.
- **Every advance — correct answer, solution-triggered, or "Finish" on the last question — goes through the identical `loadCurrentQuestion()` call**, never a client-computed next state. The final question's "Finish" button doesn't locally decide the session is over; it calls the same function as every other "Next Question" click, which then receives the real 409 from the server and renders the terminal branch from that. One advance mechanism, not two.

### Live verification (both servers running)
- **Full loop, real content** (Rational Numbers, exact-match answers read from `answer_keys.json` for a deterministic walkthrough): Q1 answered correctly on the first attempt → "Excellent!" + Next Question. Q2 walked through all three coaching stages on purpose — wrong attempt 1 → TRY_AGAIN (input stays enabled); wrong attempt 2 → SHOW_HINT (`hint-button-suggested` pulse class confirmed via DOM inspection, not just visually); revealed a hint (confirmed **no** network request fired for it); wrong attempt 3 → SHOW_SOLUTION (input immediately disabled, confirmed via DOM); revealed the solution (`SolutionPanel` rendered); clicked Next Question → **landed correctly on Q3**, confirming the session had already advanced server-side during the attempt-3 submission itself. Q3 and Q4 answered correctly and advanced normally.
- **Final question**: correct answer on Q5 of 5 → button read **"Finish"**, not "Next Question" (confirms `sessionStatus` was read correctly off the submit response). Clicking it issued a `GET current-question` that came back `409`, rendering "Session Complete — You've completed this session." with no score shown, exactly as designed.
- **409 terminal handling on direct navigation**: re-visited the now-finished session's URL directly → immediately showed the same terminal placeholder, no crash, no flash of stale question content.
- **Duplicate-submission prevention**: double-clicked "Check Answer" on a real question → network log showed exactly one `POST /answer`, not two.
- **Invalid session handling**: visited `/session/totally-invalid-id` while logged in → "This session isn't available." + Back to Dashboard, no crash.
- **An unrelated, real finding, not a bug**: starting a second Rational Numbers session immediately after finishing the first one returned a genuine backend `400` ("No questions available... matching the requested configuration") — Rational Numbers has only 5 questions total, and `learning_context_service`'s `recentQuestionIds` exclusion (last 10 seen) had just excluded all 5. `StartPracticePage`'s existing Sprint A error handling surfaced the real backend message correctly, unprompted. Confirms that error path against genuine backend behavior, not just a mocked test case.
- **Mobile viewport (375×812)**: checked at three points — initial question, mid-coaching-feedback (TRY_AGAIN message wrapped cleanly), and hint-revealed state (button label wraps to two lines, no overflow). No console errors anywhere in the entire walkthrough.
- Regression check: the pre-existing anonymous `/chapters` flow re-verified working identically.
- Test data (a third teacher/class/student and the sessions created above) removed from `backend/app/data/` afterward — all gitignored, none existed before this verification.

### Definition of Done
- [x] The complete learning loop functions end-to-end, live-verified through a full 5-question session including every coaching branch (correct, TRY_AGAIN, SHOW_HINT, SHOW_SOLUTION) and the terminal transition
- [x] Existing tests remain green
- [x] New tests pass — 75/75 frontend, 198/198 backend (unaffected, re-run fresh)
- [x] `tsc -b` / `oxlint` clean
- [x] No console errors (live-verified across every screen and edge case above)
- [x] Mobile layout confirmed
- [x] Duplicate-submission prevention verified live, not just logically reasoned
- [x] Invalid session and 409 terminal handling both verified live
- [x] All ADR-006/ADR-007 invariants maintained (server-derived attempt numbers, no client-side position tracking, SHOW_SOLUTION's server-side advance respected as-designed)
- [x] Documentation updated — this file only, per Sprint B's explicit policy
- [ ] Commit — see this repository's `git log` for the resulting hash, recorded after commit

## Sprint A — Complete the Learning Session Entry Flow (2026-07-29)

**Scope**: the full Dashboard → Session Configuration → Session Creation → First Question Loading path in one sprint, superseding the plan's original Slice 2/Slice 3 split and the display-only portion of Slice 4 — explicitly *not* another single-slice increment, per this sprint's own instruction. Answer submission is deliberately not implemented; the question screen stops immediately before it.

Per this sprint's documentation policy, only this file is updated — `PROJECT_STATUS.md`, `Development-Journal.md`, and `Release-Plan-v1.0.md` are left as they were after Slice 1, since nothing in this sprint uncovered a genuine architectural issue.

### Files added
- `frontend/src/types/session.ts` — `SessionMode`, `RequestedDifficulty`, `SessionStatus`, `CreateSessionRequest/Response`, `QuestionContent`, `CurrentQuestionResponse`, `SessionTerminalResponse`, and a `CurrentQuestionResult` discriminated union (`question` / `terminal` / `not-found`) so callers never have to re-derive which of `GET current-question`'s three real outcomes a response represents. `questionTypes` is deliberately absent from `CreateSessionRequest` — matching the plan's explicit instruction that no question-type control should exist, since `QuestionCandidate.type` is still always `null` (ADR-006).
- `frontend/src/services/sessionService.ts` — `createSession()`, `getCurrentQuestion()`. Mirrors `authService.ts`'s `parseErrorMessage`/`credentials: 'include'` pattern exactly. `getCurrentQuestion` branches on `409` (terminal, reads the session summary straight out of the error body per ADR-007 rather than a second call) and `404` (not found/not yours) before falling through to the live-question case.
- `frontend/src/components/SessionModeSelector.tsx` + `.css` — the configuration form controls: Mode (Practice/Revision/Test, plain-language descriptions), Difficulty (`Mixed`/`Easy`/`Medium`/`Hard` only), Number of questions, and Time limit — the last field renders only when Test mode is selected.
- `frontend/src/pages/StartPracticePage.tsx` + `.css` — the `/practice/:chapterId` screen: loads the chapter for display, holds `SessionConfig` as a single controlled object, validates question count and (Test-mode-only) time limit client-side before ever calling the API, calls `sessionService.createSession`, and navigates to `/session/:sessionId` on success — passing a shortfall message via router `state` when `response.shortfall` is true.
- `frontend/src/pages/SessionQuestionPage.tsx` + `.css` — the `/session/:sessionId` screen: fetches `current-question` on mount, renders it via the reused `QuestionProgress`/`DifficultyBadge`/`AnswerInput` (see Notable decisions), and handles all three `CurrentQuestionResult` cases plus a generic load failure with a graceful message and a "Back to Dashboard" link, never a raw error or a crash.
- `frontend/tests/services/sessionService.test.ts`, `frontend/tests/components/SessionModeSelector.test.tsx`.

### Files modified
- `frontend/src/App.tsx` — added `/practice/:chapterId` and `/session/:sessionId`, both wrapped in `RequireStudent` (Slice 1's guard, unmodified).
- `frontend/src/components/ChapterPerformanceCard.tsx` + `.css` — **"Start Practice" is now enabled.** The button navigates to `/practice/{chapter.id}` instead of being a disabled placeholder; the now-unreachable `:disabled` CSS rule was removed rather than left as dead code.
- `frontend/tests/components/ChapterPerformanceCard.test.tsx` — added the `react-router-dom` mock `ChapterCard.test.tsx` already established, replaced the "renders disabled" test with a "navigates on click" test.

### Tests added
- 12 new frontend tests (6 `sessionService`, 6 `SessionModeSelector`) plus 1 updated `ChapterPerformanceCard` test — full suite: **71/71 passing** (59 → 71). `tsc -b` and `oxlint` both clean. Backend untouched: **198/198 pytest**, re-run fresh.
- No page-level tests for `StartPracticePage` or `SessionQuestionPage`, matching this repository's established, unbroken convention — no page anywhere in this codebase has one; verified live instead (below).

### Notable implementation decisions
- **`AnswerInput` is reused, not hidden, and rendered fully `disabled`** (both the input and the button — confirmed via the live DOM, not just the prop), with a plain note ("Answering questions is coming in the next update.") beneath it. Rejected omitting it entirely: reuse-first per this sprint's own instruction, and it previews the real shape of the next sprint's work rather than a placeholder paragraph. Hint/solution reveal (`HintPanel`/`SolutionPanel`) are deliberately **not** rendered at all yet — both are thematically part of the answering experience this sprint explicitly stops before, not just cosmetically adjacent to it.
- **Shortfall messaging travels via React Router's `navigate(..., { state })`**, not a query string or new client-side store. It's read once on `SessionQuestionPage` via `useLocation()` and never persisted — a page refresh loses it, which is correct: the shortfall was a one-time fact about *that* creation, not an ongoing property of the session. No new dependency, no new abstraction.
- **`SessionQuestionPage` reuses `QuestionPage.css`'s classes directly** (`.question-header`, `.meta-row`, `.q-number`, `.question-card`, `.question-text`) via a direct import, exactly the reuse pattern Slice 1 established with `ChapterCard.css` — plus its own small `SessionQuestionPage.css` only for the shortfall notice and the answering-note text.
- **`StartPracticePage`'s "chapter not found" guard fires identically during genuine loading and a real 404**, deliberately matching `ChapterPage.tsx`'s own long-accepted convention (and its documented transient-flash trade-off from Feature 012) rather than inventing a three-state loading pattern nothing else in this codebase uses.
- **Client-side validation blocks the network call entirely** for a non-positive question count or (Test-mode-only) time limit — confirmed live: no `POST /sessions` fires when validation rejects the form.

### Live verification (both servers running)
- Full path, start to finish: real student join → Dashboard → "Start Practice" (now enabled) on Linear Equations → configuration form (Practice default; selecting Test correctly reveals the time-limit field, selecting Practice again correctly hides it; no question-type control exists) → set question count to 3 → Start Session → `POST /sessions` (200) → auto-navigated to `/session/{id}` → `GET current-question` (200) → **Question 1 of 3, Easy, question text, progress dots, disabled answer input, "coming in the next update" note — all rendered correctly, zero console errors.**
- **Shortfall**: requested 20 questions from Data Handling (5 total in the runtime bank) → session created with all 5 → question screen showed "Found 5 of 20 questions for this setup." above the first question.
- **Validation**: set question count to `0` on a real form → inline error shown, confirmed via the network log that no second `POST /sessions` request was ever sent.
- **Guard coverage on the two new routes**: logged out (via a real `/auth/logout` call, not a stubbed one) → direct visits to both `/practice/linear-equations` and `/session/anything` redirected to `/student/join`, exactly like `/dashboard` did in Slice 1.
- **404 handling**: logged back in, visited `/session/does-not-exist` → "This session isn't available." + Back to Dashboard, no crash, no raw error.
- Mobile viewport (375×812) checked on both the configuration form and the question screen — no overflow on either.
- Regression check: the pre-existing anonymous `/chapters` flow re-verified working identically.
- Test data (a second teacher/class/student and the sessions created above) removed from `backend/app/data/` afterward — all gitignored, none existed before this verification.

### Definition of Done
- [x] Sprint A implemented per instruction — Dashboard → Configuration → Creation → First Question, answer submission explicitly excluded
- [x] First question displayed from the Session Engine, live-verified
- [x] No answer submission implemented (confirmed via disabled DOM state, not just the absence of a handler)
- [x] Frontend tests passing — 71/71
- [x] Backend tests passing — 198/198 (unaffected, re-run fresh)
- [x] `tsc -b` / `oxlint` clean
- [x] No console errors (live-verified across every screen and edge case above)
- [x] Responsive layout confirmed (mobile viewport, both new pages)
- [x] Documentation updated — this file only, per Sprint A's explicit policy
- [ ] Commit — see this repository's `git log` for the resulting hash, recorded after commit

## Slice 1 — Student Authentication & Dashboard Foundation (2026-07-29)

**Scope, per the approved plan's §3 Slice 1**: `RequireStudent` route guard, `DashboardPage` shell (chapter list + server-side performance), the `StudentJoinPage → /dashboard` navigation change. Session creation, Start Practice's real functionality, and resume support are explicitly out of scope — deferred to Slices 2/3/7.

### Files added
- `frontend/src/types/performance.ts` — `TopicPerformance`, mirroring `app/schemas/performance.py` field-for-field. No frontend type existed for this response shape before this slice (it had no consumer).
- `frontend/src/services/performanceService.ts` — `getMyPerformance()`, `GET /performance/me` with `credentials: 'include'`. Returns `[]` on `401` rather than throwing (mirrors `authService.getCurrentUser()`'s existing 401-is-not-an-error convention) rather than surfacing an error state for a condition `RequireStudent` already guards against.
- `frontend/src/components/RequireStudent.tsx` — checks `authService.getCurrentUser()` on mount; redirects to `/student/join` (`replace: true`, so the guarded route doesn't remain in browser history) unless the resolved user's `role === 'student'`. Renders a `"Loading…"` state until the check resolves.
- `frontend/src/components/ChapterPerformanceCard.tsx` + `.css` — new sibling to `ChapterCard.tsx`, not a modification of it (see Notable decisions). Reuses `ChapterCard.css`'s classes (`.chapter-card`, `.chapter-card-content`, `.chapter-card-main`, `.chapter-desc`, `.chapter-progress-badge`) via a direct import, with its own small CSS file only for the two things that differ: a non-clickable card (`cursor: default`, no hover-lift) and the disabled "Start Practice" button.
- `frontend/src/pages/DashboardPage.tsx` + `.css` — the new `/dashboard` shell.
- `frontend/tests/services/performanceService.test.ts`, `frontend/tests/components/RequireStudent.test.tsx`, `frontend/tests/components/ChapterPerformanceCard.test.tsx`.

### Files modified
- `frontend/src/App.tsx` — added the `/dashboard` route, wrapped in `RequireStudent`.
- `frontend/src/pages/StudentJoinPage.tsx` — the post-join/login "Welcome" screen's button now navigates to `/dashboard` (was `/`), relabeled "Go to Dashboard" (was "Back to Home"). One line changed; the rest of the page (join/login form, error handling) is untouched.

### Tests added
- 10 new frontend tests (3 `performanceService`, 3 `RequireStudent`, 4 `ChapterPerformanceCard`) — full suite: **59/59 passing** (49 pre-existing + 10 new). `tsc -b` and `oxlint` both clean. Backend untouched: **198/198 pytest**, re-run fresh to confirm.
- No page-level test for `DashboardPage` itself, matching this project's established, repository-wide convention — no page has ever had one; page behavior is verified live instead (see below).

### Notable implementation decisions
- **`GET /performance/me` is keyed by `topicId`, not `chapterId`** (`attempt_service.get_performance` groups by `topic_id`, `WHERE topic_id IS NOT NULL`). Correlating a chapter to its performance therefore requires looking up that chapter's `Topic` first via the existing `questionService.getTopics(chapterId)`. `DashboardPage.loadDashboard()` fetches each chapter's topics in parallel and matches on `topics[0].id` against the performance list. A direct, necessary consequence of this: **a chapter with no `Topic` (Understanding Quadrilaterals, Practical Geometry, Data Handling, as of this commit) can never show a performance badge**, regardless of how many attempts a student makes there, since those attempts are recorded with `topic_id = NULL` and excluded from `get_performance` entirely. This is existing backend behavior, not something this slice changed or worked around — confirmed live (see below).
- **`ChapterPerformanceCard` is a new component, not a modified `ChapterCard`.** `ChapterCard.test.tsx` pins an exact navigation target and exact badge text against the existing component; editing it to add a performance variant risked breaking those three tests for no benefit, since the two cards serve different pages (anonymous `/chapters` vs. the new `/dashboard`) with different data sources (`localStorage` counts vs. server aggregates).
- **"Start Practice" renders as a real, visible, `disabled` button**, not hidden or a bare label — per the milestone's explicit instruction that Slice 2 owns its functionality. A `title="Coming soon"` tooltip is the only affordance; no `onClick` handler exists, since `/practice/:chapterId` doesn't exist yet.
- **No dedicated 401-driven redirect inside `DashboardPage` itself.** `performanceService.getMyPerformance()` degrades a `401` to `[]` rather than throwing, and `RequireStudent` is the single place that owns redirecting an unauthenticated visitor away from `/dashboard`. Avoids two different components independently deciding what an expired session means.

### Live verification (both servers running)
- Unauthenticated visit to `/dashboard` → redirected to `/student/join` (`RequireStudent` confirmed working before any real login existed).
- Registered a test teacher, created a class, joined as a student ("Asha") through the real UI (not stubbed) → "Welcome, Asha!" → "Go to Dashboard" → Dashboard renders the student's name and all 5 chapters, no performance badges (correct — fresh student, zero history).
- Submitted a real answer to a Linear Equations question via the standalone `/answer` endpoint (as the same logged-in student) → confirmed via `GET /performance/me` that the attempt was recorded → reloaded `/dashboard` → **Linear Equations alone showed "1 attempted · 0% accuracy"; the other 4 chapters (including Rational Numbers, which has a Topic but no attempts) correctly showed no badge** — validates the topic-correlation logic end-to-end, not just in a unit test.
- Mobile viewport (375×812) — chapter grid collapses to a single column, no overflow.
- No console errors at any point in the walkthrough.
- Regression check: the pre-existing anonymous flow (`Home → Select Chapter → ChapterCard`, still using `progressService`/`localStorage`) re-verified working identically, unaffected by any of this slice's changes.
- Test data (a teacher, a class, a student, and one attempt row) created for this walkthrough was removed from `backend/app/data/` afterward — all four files are gitignored and none existed before this verification.

### Definition of Done
- [x] Slice 1 implemented per plan
- [x] Application remains fully functional (anonymous flow re-verified)
- [x] Frontend tests passing — 59/59
- [x] Backend tests passing — 198/198 (unaffected, re-run fresh)
- [x] `tsc -b` / `oxlint` clean
- [x] No console errors (live-verified)
- [x] Responsive layout confirmed (mobile viewport)
- [x] Documentation updated — this file, `Development-Journal.md`, `PROJECT_STATUS.md`
- [ ] Commit — see `Development-Journal.md`'s entry for the resulting hash, recorded after commit
