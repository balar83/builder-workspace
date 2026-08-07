# Sprint C Implementation Plan — Session Completion, Resume, Final Polish

**Status:** Planning only. Not implemented. Requires architectural review/approval before starting, per RC1's own instruction.
**Grounded in:** the actual current state of `SessionQuestionPage.tsx`, `sessionService.ts`, and `types/session.ts` as of commit `695fff6` (Sprint B) — not the original `Session-Frontend-Implementation-Plan.md`'s Slice 6/7/8 sketch, which predates real implementation and is refined below where reality diverged from it.

---

## One deliberate deviation from the original plan, stated up front

`Session-Frontend-Implementation-Plan.md` originally sketched Session Completion as its own route/page (`SessionCompletePage` at `/session/:sessionId/complete`). Sprint B instead built the terminal state as an inline `phase.kind === 'terminal'` branch inside `SessionQuestionPage` — and that already works correctly: it's reachable at the same `/session/:sessionId` URL, safe to reload (re-triggers the same `409` → terminal path), and needs no navigation hop. Sprint C should **enhance that existing branch**, not introduce a parallel route — fewer moving parts, and it's what the app actually does today rather than what a pre-implementation sketch guessed it would do.

---

## Slice C1 — Session Completion

| | |
|---|---|
| **Scope** | Replace the current bare placeholder ("You've completed this session.") with a real, mode-aware summary. When `phase` becomes `terminal`, fetch `GET /sessions/{id}` once (for `mode`, which `SessionTerminalResponse` doesn't carry) and render a new `SessionCompleteSummary` component instead of the inline message. **Practice/Revision**: qualitative only — "You worked through {totalCount} questions in {chapter}." **Test mode**: the one place a score appears — "{correctCount} of {totalCount}," self-feedback framed. Status-aware copy carries over unchanged from the existing branch (`expired`/`abandoned`/`completed` framing already written and correct — reuse it, don't rewrite it). |
| **APIs used** | `GET /sessions/{id}` (new call, made once, only after a session is confirmed terminal — never on every render) |
| **New files** | `frontend/src/components/SessionCompleteSummary.tsx` + `.css` |
| **Modified files** | `frontend/src/services/sessionService.ts` (add `getSessionSummary(sessionId)`, mirroring the existing service pattern), `frontend/src/types/session.ts` (add `SessionSummaryResponse`, mirroring the backend schema — `sessionId, mode, status, position, totalCount, correctCount, startedAt, completedAt`), `frontend/src/pages/SessionQuestionPage.tsx` (terminal branch fetches the summary and renders the new component) |
| **Expected tests** | `sessionService.getSessionSummary` unit test. `SessionCompleteSummary` unit test — the important one is a **negative** assertion (mirroring `ChapterPerformanceCard.test.tsx`'s own precedent): no score renders anywhere in the DOM for `mode: 'practice'`/`'revision'`, and a score does render for `mode: 'test'`. No new page-level test, matching this repo's established convention. |
| **Acceptance criteria** | Matches `Release-Plan-v1.0.md` §6, criteria 4, 5, 8, 9 verbatim — already written, not yet implemented until this slice lands. |

## Slice C2 — Resume support

| | |
|---|---|
| **Scope** | The client-side pointer pattern `Release-Plan-v1.0.md` §13 explicitly recommended and RR1 confirmed sufficient — **not** `GET /sessions/active`, which was deliberately declined pending real evidence of need (still no such evidence). Mirrors `progressService.ts`/`progressStore.ts`'s exact split. New `localStorage` key `mtc.session-pointer.v1` (deliberately separate from Release 0.1's `mtc.progress.v1` — must never collide or be read/written by the same code path). Stores `{studentId, sessionId, chapterId, mode}`. Written once a session is created (`StartPracticePage`, right after `POST /sessions` succeeds — the same place shortfall-message navigation already happens). Cleared once a session reaches any terminal state (the same `phase.kind === 'terminal'` branch C1 touches). `DashboardPage` checks the pointer on mount; if present, confirms liveness with one `GET /sessions/{id}` and — only if the pointer's `studentId` matches the currently logged-in student — shows a `ResumeBanner` ("Continue where you left off in {chapter}"). A pointer whose `studentId` doesn't match is silently ignored, not shown — the shared-device safety check `Session-Frontend-Implementation-Plan.md` §4 named explicitly. |
| **APIs used** | `GET /sessions/{id}` (liveness check only, on Dashboard mount — same call C1 also uses, no new endpoint) |
| **New files** | `frontend/src/services/sessionPointerService.ts`, `frontend/src/services/sessionPointerStore.ts`, `frontend/src/components/ResumeBanner.tsx` + `.css` |
| **Modified files** | `frontend/src/pages/StartPracticePage.tsx` (write pointer on create), `frontend/src/pages/SessionQuestionPage.tsx` (clear pointer on terminal — same branch as C1), `frontend/src/pages/DashboardPage.tsx` (read pointer, liveness check, render banner) |
| **Expected tests** | `sessionPointerStore`/`sessionPointerService` unit tests, mirroring `progressStore.test.ts`/`progressService.test.ts` exactly — including the "missing or corrupt data falls back to empty, never throws" case, since that's the actual safety property this pattern depends on. `ResumeBanner` unit test. A specific test for the cross-student pointer-mismatch case, since it's a real, newly-introduced behavior, not just a UI nicety. |
| **Acceptance criteria** | Matches `Release-Plan-v1.0.md` §6, criterion 6. Closing the browser mid-session and reopening on the same device resumes correctly; a pointer belonging to a different student never produces a banner. |

## Slice C3 — Final UX polish

| | |
|---|---|
| **Scope** | No new features — cross-cutting hardening and the documentation catch-up every prior sprint's "docs policy" deliberately deferred to this point. (1) Loading/empty/error-state audit across `DashboardPage`, `StartPracticePage`, `SessionQuestionPage` against `Release-Plan-v1.0.md` §6's full acceptance-criteria list, one by one — not just re-reading the code, a live walkthrough. (2) Copy-consistency pass across coaching/error/status messages introduced piecemeal across Sprint A/B/C1/C2. (3) A final mobile-viewport pass across all five session-flow pages together, not just the spot-checks each sprint did individually. (4) The documentation catch-up table from `Release-Plan-v1.0.md` §8 — `HANDOFF_PROMPT.md`, `PROJECT_STATUS.md`, `ProductArchitecture.md` (new §19 for the Session Frontend), `Roadmap.md`/`Backlog.md`, `Release-Notes.md` — all still reflect the pre-Slice-1 state, since RR1/F0/Sprint A/Sprint B/RC1 each explicitly restricted their own documentation updates to a narrower set of files. This is where that debt actually gets paid down, per the original plan's own Slice 8 design and this project's Documentation Responsibility convention. **Not in scope**: the pre-existing, separately-tracked P1 progress-dot crowding issue (`Roadmap.md`'s Milestone F) — real, but a different backlog item than this Sprint's Session Frontend work; worth a look if time allows, not a blocker. |
| **APIs used** | None new. |
| **Expected tests** | Full fresh re-run of `pytest` + `vitest run` + `tsc -b` + `oxlint`; no new tests expected unless the audit surfaces a real gap. |
| **Acceptance criteria** | All 11 acceptance criteria in `Release-Plan-v1.0.md` §6 individually reconfirmed via live walkthrough, not assumed from C1/C2's own testing. Documentation table fully current. This is the point at which `v1.0.0` (not just an RC) becomes a real, defensible tag — though cutting it remains the user's call, not something to do unprompted. |

---

## Implementation order and why

**C1 → C2 → C3.** Completion has to exist before Resume's "clear the pointer on terminal" step has anywhere real to hook into — building C2 first would mean writing that clear-on-terminal logic against the placeholder, then rewriting it once C1 lands. Polish is last by definition — it's a pass over what C1 and C2 actually produced, not something to do in parallel with still-changing UI.

Each slice leaves the app fully working end to end, matching every prior sprint's own discipline: after C1 alone, the loop works with a real summary but no resume; after C2 alone (on top of C1), resume works too; nothing in between is ever broken.
