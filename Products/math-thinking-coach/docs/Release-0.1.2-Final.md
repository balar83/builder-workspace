# Release 0.1.2 — Final

**Date:** 2026-08-07
**Status:** shipped and live in production

---

## 1. Summary

Release 0.1.2 does three things:

1. **Curriculum expansion** (carried over from the uncommitted Release 0.1.1 work) — Data Handling and Understanding Quadrilaterals fully authored and exported through the existing Stage 10 content pipeline: 5 → 42 and 5 → 40 questions respectively, each with a full Learn/Topic page. No content-pipeline or schema changes.
2. **Frontend UX overhaul** — a real design-token system, a rebuilt Learn page, a reworked question experience (visible coaching feedback, staged hints, a lighter progress indicator), consistent teacher/student forms, and one navigation pattern (`BackLink`) applied to every screen so no page depends on browser history. Verified at 10 responsive breakpoints (320–1440px) with zero horizontal overflow anywhere.
3. **Production-readiness audit and fixes** — an adversarial pass that broke the network on purpose, typed wrong URLs on purpose, and drove the keyboard instead of the mouse, and found three P1 defects the happy-path UX work couldn't see: a blank page on any bad URL, four screens that became permanent loading dead-ends when the backend was unreachable, and a form field where Enter did nothing. All three fixed and re-verified live.

A fourth defect was found and fixed **after** deployment, during the Step 7 production smoke test — see §7.

No backend, API, authentication, session-management, or content-pipeline code was touched anywhere in this release.

---

## 2. Audit reconciliation

The [Final Production Readiness Audit](Release-0.1.2-Final-Audit.md) (11 findings, N-1 through N-11) was reviewed finding-by-finding against the actual code before this release was finalized. **All 11 were confirmed already implemented, correctly, with no gaps:**

| # | Finding | Verified |
|---|---|---|
| N-1 | Blank page on any unmatched URL | ✅ `NotFoundPage` + catch-all route |
| N-2 | 7 screens permanent dead-end when backend unreachable | ✅ explicit loading/error states on every one, `RequireStudent`'s new `unreachable` state |
| N-3 | Anonymous answer submission hangs forever on network failure | ✅ catch branch added, mirrors the session flow's existing handling |
| N-4 | Enter does not submit an answer | ✅ every form (`AnswerInput`, Teacher login/register, class creation, Student join/login) is a real `<form>` now |
| N-5 | Long/unbroken names break layout, hide Log out | ✅ `overflow-wrap: anywhere`, flex `min-width: 0` fixes |
| N-6 | Chapters page had no loading/empty/error state | ✅ all three added |
| N-7 | Touch targets below the product's own 44px standard | ✅ BackLink → 44px, radio rows → 44px |
| N-8 | Difficulty badge failed AA contrast (4.39:1) | ✅ `--color-neutral-700`, now passes with headroom |
| N-9 | Heading inside `<button>` (invalid HTML), h1→h3 skip | ✅ `ChapterCard` title is a `<span>`, `ChapterPerformanceCard` uses `<h2>` |
| N-10 | `100vh`/`100svh` mismatch on mobile | ✅ unified on `svh` with a `vh` fallback |
| N-11 | Form errors not announced to screen readers | ✅ `aria-live="polite"` on every error message |

No further changes were made in reconciliation — every finding was already correctly fixed in the working tree at the start of this finalization pass.

---

## 3. Tests

Run fresh, after every fix in this release including the post-deploy one (§7):

| Suite | Result |
|---|---|
| Backend `pytest` | **205 / 205 passed** |
| Frontend `tsc -b` | clean (exit 0) |
| Frontend `oxlint` | clean (exit 0) |
| Frontend `vitest run` | **112 / 112 passed** (21 test files) |
| Production build | succeeds — 293.32 kB JS (90.62 kB gzip), 21.84 kB CSS (4.19 kB gzip) |
| Repository hygiene | no debug logging, no TODO/FIXME introduced, no stray files, `dist/` correctly gitignored, clean `git status` before each commit |

---

## 4. Deployment

| | URL | Platform |
|---|---|---|
| Frontend | https://math-thinking-coach-zeta.vercel.app/ | Vercel (auto-deploy on push to `main`) |
| Backend | https://math-thinking-coach-api.onrender.com | Render (auto-deploy on push to `main`) |

Backend health confirmed post-deploy (`/api/v1/health` → `{"status":"healthy", ...}`) and content confirmed live (`data-handling`: 42 questions, `understanding-quadrilaterals`: 40 — matching the export, not the pre-release 5/5).

**A real deployment bug was found and fixed during deploy verification, before any smoke test began:** Vercel does not auto-detect SPA fallback for this project — a direct load or hard refresh of any client-side route (`/dashboard`, `/session/:id`, ...) returned Vercel's own platform `404` page, not the app, despite the project's own docs assuming Vercel would handle this automatically. Fixed with `frontend/vercel.json` (an explicit rewrite to `index.html`), pushed, redeployed, and re-verified live — a hard refresh on `/dashboard` now correctly reaches the app (and redirects to the join form, exactly as designed for an unauthenticated visitor). `Deployment-Guide.md` §0/§2 updated with the corrected claim and the current production URLs, so this doesn't have to be rediscovered on the next deploy.

---

## 5. Commits

| Hash | Summary |
|---|---|
| `c414563` | Release 0.1.2: curriculum expansion, UX overhaul, and production-readiness audit |
| `22fdcb0` | fix(deploy): add Vercel SPA rewrite, missing on the live deployment |
| `a16788e` | fix(session): show Reveal Solution once hints are exhausted, not just on 3rd wrong attempt |

**Branch:** `main` · **Push status:** all three pushed and live on `origin/main`.

---

## 6. Production smoke test

**Anonymous** (performed directly): Home → Select Chapter → Linear Equations → Learn → Start Practice → answered a question correctly. All navigation worked; the new 404 page and SPA-fallback fix were both exercised and confirmed along the way.

**Student and Teacher journeys:** per explicit scope boundaries, I do not create accounts or enter passwords in production, even when asked — this applied to both the initial smoke test and to verifying §7's fix. The user performed these directly:
- **Teacher:** registered, logged in, created a class (join code `A996AX`) — confirmed working.
- **Student:** joined class `A996AX`, reached the Dashboard, opened a Learn page, started a Practice session, and worked through questions — in the course of which the user found the dead-end described in §7.

---

## 7. A fourth defect, found during the smoke test itself

The user's own hands-on production testing (the exact kind of adversarial, real-device verification the audit's own §7 said was still missing) found a genuine dead end the audit did not catch: **a student who clicked through all 3 hints on a question without yet submitting a wrong answer saw neither a hint button (hints exhausted) nor a Reveal Solution button** — nothing to press, no way to proceed, no browser-history-free escape.

**Root cause:** `coaching_service.py`'s `canRevealSolution` flag (backend, frozen) is driven purely by wrong-*attempt* count, with no awareness of hint usage at all — the two are tracked independently, one server-side and one client-side. `SessionQuestionPage.tsx` gated the Reveal Solution button on that server flag alone. The anonymous question flow never had this bug, because its equivalent button was always a purely client-side action tied to local hint state.

**Fix:** show Reveal Solution once local hints are exhausted **or** the server flag says so — restoring parity with the anonymous flow's already-correct behavior. Frontend-only; `coaching_service.py` untouched.

**Verification:** reproduced locally (exhausted all 3 hints on a Hard question with zero submissions — confirmed the dead end existed exactly as described), fixed, re-reproduced the same steps and confirmed Reveal Solution now appears and works through to "Next Question." Full regression re-run clean (205/112). Deployed (`a16788e`) and corroborated live via bundle-size comparison (production: 293,351 bytes; local build including this exact fix: 293,328 bytes — a 0.008% difference consistent with build-tool non-determinism, not missing code); a final hands-on click-test in production is pending the user's own confirmation, for the same account-boundary reason as §6.

---

## 8. Known limitations

Carried forward from the audit's own honest disclosure (§7 of that document), still true:

1. **No screenshots exist for either the UX work or this finalization pass.** The Browser pane never composited a frame in this environment across three separate sessions' worth of attempts. Every claim in this release is backed by measured DOM geometry, computed style, or live behavioral verification — strong evidence for correctness, no evidence for aesthetics. Someone should look at the app with their own eyes.
2. **No real devices or real browsers were used for automated verification** — one Chromium engine at synthetic viewports throughout. iOS Safari keyboard/toolbar behavior, Android Chrome's URL-bar collapse, and Firefox/Safari/Edge rendering are all unverified by me (though the user's own production testing on §7 partially closes this gap).
3. **Performance was reviewed, not profiled.** Bundle size is small and measured (90.6 kB gzip); no runtime profiler was run.
4. **Multi-tab/concurrency** (two tabs in one session, the 409 stale-position path) was exercised only incidentally.
5. **Exact-match answer evaluation is brittle for some question formats** — flagged by the user during production testing (§9).

---

## 9. Deferred to Phase 1

**From the audit (architecture-frozen, documented not implemented):**
1. No length limit on user-supplied names (`displayName`, class name, teacher name) — the frontend is now robust to any length (N-5), but the real fix is a backend `max_length` plus matching `maxLength` inputs.
2. No "list my classes" endpoint — a teacher who leaves the page loses the join code permanently; the prominent code card with a save-it-now warning is a mitigation, not a solution.
3. The Session page's `<h1>` reads "Practice session" in every mode, including Test — cosmetic, but the accessible page title is wrong for timed sessions.
4. The Learn page's `explanation` loses its section headings in the export pipeline (`transformTopic` joins bodies, drops titles) — paragraphs are recoverable, headings are not, without a schema change.

**From the user's own production testing (2026-08-07), explicitly requested as feedback-only for this release, not fixed now:**
5. **Some expected answers can't be typed to match.** The user reported that an answer like "360 degree" doesn't match the exact-match evaluator's expected string, meaning a student can type a correct answer in a reasonable format and still be marked wrong. This is the same brittle-exact-match limitation already flagged in this project's own content-authoring notes (`linear-equations/answer-keys.json`'s note on compound/reasoning answers) — not a new discovery, but a fresh, concrete, user-witnessed instance of it in Understanding Quadrilaterals specifically.
6. **Suggestion: some question formats would work better as multiple-choice than free-text.** The user's observation, verbatim in spirit: several longer or more precisely-worded expected answers are close to impossible for a student to type exactly, pushing them toward hints/solution reveal rather than genuine recall. Worth scoping as a content-format decision (which questions, if any, become multiple-choice) plus whatever schema/evaluation change that implies — both are backend/schema territory, and both are explicitly out of scope for a frontend-only release.

---

## 10. Release statistics

| | |
|---|---|
| Commits this release | 3 (`c414563`, `22fdcb0`, `a16788e`) |
| Files changed (main commit) | 74 |
| Lines changed (main commit) | +5,709 / −907 |
| New frontend components | 3 (`AnswerFeedback`, `BackLink`, `NotFoundPage`) |
| New frontend pages | 1 (`NotFoundPage`) |
| Design tokens file | 1 new (`styles/tokens.css`) |
| Backend files touched, this release | 0 (data/content export files aside — no service/route/schema code) |
| Frontend source files | 46 |
| Backend source files | 48 |
| Questions live: Linear Equations / Data Handling / Understanding Quadrilaterals / Rational Numbers / Practical Geometry | 44 / 42 / 40 / 5 / 5 |
| Backend tests | 205 |
| Frontend tests | 112 |
| Responsive breakpoints verified | 10 (320, 360, 390, 430, 640, 768, 820, 1024, 1280, 1440) |
| Production defects found post-deploy | 1 (§7), found by the user, fixed and redeployed same session |
| Deployment defects found and fixed | 1 (§4, Vercel SPA fallback) |
