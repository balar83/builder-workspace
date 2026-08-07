# Release 0.1.2 — Final Production Readiness Audit

**Date:** 2026-08-07
**Role:** Independent release audit (QA / UX / accessibility / release management)
**Posture:** adversarial — the RC was assumed *not* production ready until proven otherwise, and every claim in `UX-Polish-Release-0.1.2-RC.md` was re-verified from scratch rather than accepted.
**Scope honoured:** frontend only. Zero backend, API, auth, session-management, deployment, schema, content-pipeline, routing-redesign or feature-redesign changes.

---

## 1. Executive Summary

**Production ready: YES — after the fixes in this audit. NO as the RC stood.**

**Confidence: 88%.**

The RC's own report was accurate about the work it described. Its foundation is genuinely good: the design-token system is real, the responsive layout is genuinely robust (verified at ten widths, not the eight claimed), and colour contrast is essentially clean. The RC's headline claim — zero horizontal overflow on every screen at every breakpoint — **is true**, and I confirmed it independently.

But the RC verified the *happy path*. Three classes of defect survived it, all reachable by ordinary users:

1. **Any invalid URL rendered a completely blank white page** — no text, no heading, no control. The single worst dead end in the app, in a release whose stated headline feature was "every screen has an intentional way out."
2. **With the backend unreachable, four screens became permanent "Loading…" dead ends with zero interactive elements** — including the Dashboard, whose carefully-written Retry button could never render because the route guard swallowed the failure first.
3. **Pressing Enter did not submit an answer** — the most-repeated interaction in the product (44 questions in Linear Equations alone) required a mouse or tap every single time.

None of these were visible to the RC's method, because DOM-and-computed-style inspection of a working app cannot see them. They only appear when you break the network on purpose, type a wrong URL on purpose, and drive the keyboard instead of calling `element.click()`.

Two RC claims were **factually wrong** and are corrected below (§2, N-7).

The 12% of confidence I am withholding is stated honestly in §7 — it is not hedging, it is the specific things this environment could not test.

---

## 2. Corrections to the RC report

| RC claim | Finding |
|---|---|
| "zero sub-44px touch targets, anywhere" | **False.** Every `.link-button` measured 25px tall — including every BackLink, the release's own headline navigation control. The Session Mode radio rows measured **22px**, below the 24px WCAG 2.2 SC 2.5.8 (AA) floor. Fixed. |
| Part 3 "tested at all eight required widths across every screen" | The sweep was real and its overflow conclusion holds, but it measured only overflow/target/font-size on **loaded** screens. No loading, error, empty or offline state was tested at any width, and those are where the defects were. |
| Screenshots unavailable | **Confirmed true, independently.** Every `screenshot` call in this session also timed out ("the Browser pane is not displayed, so the page is not compositing frames"). This is an environment limitation, not an excuse. All evidence below is measured DOM geometry and computed style. |

---

## 3. Issues Found

Severity: **P1** = blocks release · **P2** = fix before shipping to a paying school · **P3** = polish.

### N-1 · P1 · Any invalid URL renders a blank white page

**Evidence (before):** navigating to `/this-route-does-not-exist` returned
`{"url":"/this-route-does-not-exist","bodyText":"","rootHTML":""}` — an empty `<div id="root">`.

**Root cause:** `App.tsx` declared nine routes and no `path="*"` fallback. React Router matched nothing and rendered nothing.

**Why it matters:** reachable from a mistyped link, a truncated shared URL, or a stale bookmark. The only escape was the browser Back button — precisely what the release set out to eliminate.

**Fix:** new `NotFoundPage` + catch-all route.
**After:** `h1 "Page not found"`, explanatory copy, and two working actions (Go to Home / Browse chapters).
**Files:** `src/pages/NotFoundPage.tsx` (new), `src/App.tsx`

---

### N-2 · P1 · Backend unavailable → four screens are permanent dead ends

**Evidence (before)** — `fetch` stubbed to reject, per screen, showing rendered text and every button present:

| Screen | Text shown | Buttons |
|---|---|---|
| Dashboard | `Loading…` | **none** |
| Start Practice | `Loading…` | **none** |
| Session | `Loading…` | **none** |
| Learn (Topic) | `Lesson Loading…` | **none** |
| Chapters | heading + tagline, nothing else | back only |
| Chapter | `Chapter not found.` | back only |
| Question | `Question not found for the selected chapter.` | back only |

**Root cause:** two distinct bugs.
- `RequireStudent` called `authService.getCurrentUser().then(...)` with **no `.catch()`**. `getCurrentUser` resolves to `undefined` on a clean 401 but *throws* on any other failure, so an unreachable server left the guard in `'checking'` forever. Because the guard gates `/dashboard`, `/practice/:id` and `/session/:id`, all three pages never mounted — `DashboardPage`'s existing error+Retry state and `SessionQuestionPage`'s existing `load-error` state were unreachable code in the exact scenario they were written for.
- `TopicPage`, `ChapterSelectionPage`, `ChapterPage`, `QuestionPage` and `StartPracticePage` each had an unhandled promise rejection on load, and none distinguished *loading* from *missing* — so "not found" was shown both while still loading (a false error on every single visit) and on network failure (a wrong diagnosis).

**Fix:** a rejection branch on every load path; an explicit `loading | loaded | error` state on each page; a distinct `unreachable` state in `RequireStudent` that offers Try again + Go to Home and — importantly — does **not** redirect to the join form, because "can't reach the server" is not "not logged in".

**After:** all seven screens now show an explanatory message and at least two working controls. Recovery verified live: failing the network, landing on the error state, restoring the network and clicking **Try again** returned the real Dashboard (`Welcome, QA Audit Student! …`) and the real chapter list.

**Files:** `src/components/RequireStudent.tsx`, `src/pages/{TopicPage,ChapterSelectionPage,ChapterPage,QuestionPage,StartPracticePage}.tsx`

---

### N-3 · P1 · Anonymous answer submission hangs forever on network failure

**Evidence (before):** with only `/answer` failing, the feedback panel sat on
`… Checking your answer…` permanently. No error, no timeout, no recovery.

**Root cause:** `QuestionPage.handleAnswerSubmit` had `.then()` and no `.catch()`. `SessionQuestionPage` already handled this correctly — the anonymous flow simply never got the same treatment.

**Fix:** catch, clear the checking state, surface an `aria-live` error.
**After (measured, clean page load):** fails with `We couldn't check your answer. Check your connection and try again.`, `stuckOnChecking: false`; pressing Check Answer again after the network returns produces real coaching feedback (`↻ Not quite. Try solving it once more before using a hint.`).
**Files:** `src/pages/QuestionPage.tsx`

---

### N-4 · P2 · Enter does not submit an answer

**Evidence (before):** `{"enterDidSomething":false,"inForm":false}` — the answer field was a bare `<input>` outside any `<form>`, with no key handler. Enter did nothing on desktop; a phone keyboard's Go key did nothing.

**Why it matters:** this is *the* core loop of the product, repeated 44 times in one chapter, by children, often on phones.

**Fix:** `AnswerInput` is now a real `<form>` with `type="submit"` and `enterKeyHint="send"`. The same gap existed on Teacher login/registration, class creation, and Student join/login — all four are now real forms too.

**After:** Enter alone submits and evaluates — `✓ Excellent! You solved it correctly.` — verified in both the anonymous flow and the authenticated session flow, and on the teacher login form (which correctly surfaced `Invalid email or password`).
**Files:** `src/components/AnswerInput.tsx`, `src/pages/{TeacherAuthPage,StudentJoinPage}.tsx`

---

### N-5 · P2 · Long or unbroken names break the layout and hide Log out

**Evidence (before), 360px viewport:**

| Case | Horizontal page scroll | Consequence |
|---|---|---|
| Dashboard, long unspaced student name | **738px** | Log out rendered at `x = 1058–1098` — **entirely off-screen and unreachable** |
| Chapter card, long unspaced title | 327px | page scrolls sideways |
| Session question, long unbroken text | 396px | page scrolls sideways |

**Root cause:** `overflow-wrap` was `normal` app-wide, and the flex headers relied on the default `min-width: auto`, so a single long token forced the whole row wider than the viewport.

**Reachability:** `displayName` is plain `str` in the backend schema with no `max_length`, and there is no `maxLength` on any frontend input. A child typing a long name or mashing keys reaches this with no tampering. (The backend is frozen, and CSS robustness is the correct fix regardless — the UI must survive any content it is given.)

**Fix:** `overflow-wrap: anywhere` on text-bearing elements; `min-width: 0` on the flex text column and `flex-shrink: 0` on the exit control, in both the Dashboard and Teacher Home headers.

**After (same 360px viewport):** horizontal scroll **0** in all three cases; Log out at `x = 279–344`, `logoutOnScreen: true`. Re-confirmed on Teacher Home with a long teacher name *and* a 91-character class name: scroll 0, Log out on-screen.
**Files:** `src/index.css`, `src/pages/DashboardPage.css`, `src/pages/TeacherAuthPage.css`

---

### N-6 · P2 · Chapters page had no loading, empty or error state

**Root cause:** a failed `getChapters()` left `chapters` at `[]`, rendering the heading over blank space — indistinguishable from "this product has no chapters."
**Fix:** explicit loading / error+Retry / genuine-empty states.
**Files:** `src/pages/ChapterSelectionPage.tsx`

---

### N-7 · P2 · Touch targets below the product's own standard; radio rows fail WCAG AA

**Evidence (before):** `.link-button` = **25px** tall (every BackLink, Log out, Cancel, and both mode switchers). `label.session-mode-option` = **22px** tall — and since the radio itself is 13×13px, the label *is* the target.

22px fails **WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA** (24px). 25px passes that floor but misses the 44px standard this product set for itself in `tokens.css` (`--control-height: 44px`, commented "WCAG 2.5.5 / Apple HIG").

**Fix:** BackLink → 44px (via `.link-button.back-link`, two classes deliberately — a single-class selector lost a specificity tie with `.link-button { min-height: 0 }` and silently left it at 33px, which I caught only by re-measuring after the first attempt). Radio rows → 44px min-height with padding. Inline `.link-button`s → ~33px via vertical padding, which is all that is safe without breaking the line box in running text.

**After:** BackLink `{"w":62,"h":44}` — full-height target, still text-width so nothing looks different. Radio row 44px (61px when the label wraps). The automated sweep now reports **zero** controls under 32px on every screen at every breakpoint.
**Files:** `src/components/BackLink.css`, `src/components/SessionModeSelector.css`, `src/App.css`

---

### N-8 · P3 · Difficulty badge fails AA contrast

**Evidence:** `#6b7280` on `#f3f4f6` at 13px = **4.39:1**, against a 4.5:1 requirement. Affects all three difficulty levels on every question screen.
**Fix:** `--color-neutral-700`.
**After:** zero contrast failures across all 12 screens.
**Files:** `src/components/DifficultyBadge.css`

---

### N-9 · P3 · Invalid heading structure

**Evidence:** `document.querySelectorAll('button h1,button h2,button h3,button h4').length === 5` on the Chapters page. `<h3>` inside `<button>` is invalid HTML (button takes phrasing content only) and no assistive technology exposes it as a heading — the button's accessible name flattens it. Separately, Dashboard went `h1 → h3`, skipping a level.

**Fix:** ChapterCard's title → styled `<span>` (identical appearance, valid markup, and it removes the Chapters page's level skip); ChapterPerformanceCard's → `<h2>`.
**After:** `headingInButton: 0` everywhere; heading sequences are `H1`, or `H1 H2 H2 …` — no skips.
**Files:** `src/components/{ChapterCard,ChapterPerformanceCard}.tsx`, `src/components/ChapterCard.css`

---

### N-10 · P3 · `100vh` / `100svh` mismatch on mobile

`#root` used `100svh` but `.container` used `100vh`, so on any mobile browser with a collapsing toolbar the container was taller than the visible viewport and every screen scrolled by the toolbar's height even when its content fit. Unified on `svh`, with a `vh` fallback line added in both places for Safari < 15.4.
**Files:** `src/App.css`, `src/index.css`

---

### N-11 · P3 · Form errors not announced to screen readers

Login failures, join failures and Start Practice validation errors were plain `<p>` — a screen-reader user got no notification that submission had failed. `aria-live="polite"` added to all of them, matching the pattern `SessionQuestionPage` already used.
**Files:** `src/pages/{TeacherAuthPage,StudentJoinPage,StartPracticePage,QuestionPage}.tsx`

---

## 4. Responsive Matrix

Measured per screen per width: page horizontal scroll, count of elements crossing the viewport edge, controls under 32px, inputs under 16px. **Ten** widths — the eight required, plus 320 (WCAG 1.4.10 Reflow) and 640 (≈200% zoom of 1280).

`PASS` = 0 horizontal scroll, 0 overflowing elements, 0 undersized controls, 0 sub-16px inputs.

| Screen | 320 | 360 | 390 | 430 | 640 | 768 | 820 | 1024 | 1280 | 1440 |
|---|---|---|---|---|---|---|---|---|---|---|
| Home | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Page not found *(new)* | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Chapters | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Chapter | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Learn (Topic) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Question (anonymous) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Dashboard | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Start Practice | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Session (practice) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Session (test, timer) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Teacher login | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Student join | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

**Landscape** (740×360 phone, 1024×768 tablet): all 12 screens PASS, 0 overflow.
**Teacher Home, Session Complete:** PASS at 390 and 1280 (reached via live walkthrough rather than the automated sweep, since both require a live session).

The RC's core responsive claim is confirmed and extended. This layout is genuinely solid — it survives 320px, which is narrower than anything the brief asked for.

---

## 5. Accessibility Checklist

| Item | Result | Evidence |
|---|---|---|
| Keyboard navigation | PASS | Every action reachable; Enter now submits every form (was N-4) |
| Tab order | PASS | Follows DOM/visual order on every screen; `tabIndexOverrides: 0` — no positive tabindex anywhere |
| Focus visibility | PASS | One global `:focus-visible` rule (2px solid primary, 2px offset); grepped for `outline:none` / `outline:0` — **no matches**, nothing suppresses it |
| Accessible names | PASS | Zero controls without a name, label or `aria-label`, on every screen audited |
| Heading hierarchy | **FIXED** | Was `h1→h3` skip + 5 headings inside buttons; now no skips, `headingInButton: 0` |
| ARIA usage | **FIXED** | `aria-live` on all async/error regions; `aria-labelledby` on Learn sections; `aria-label="Breadcrumb"` on the Topic nav |
| Touch targets | **FIXED** | Was 22px (fails 2.5.8 AA) / 25px; now BackLink 44px, radio rows 44px, inline links ~33px; zero controls < 32px in the automated sweep |
| Reduced motion | PASS | Global `@media (prefers-reduced-motion: reduce)` in `App.css` plus a targeted rule for the hint pulse in `QuestionPage.css` |
| Contrast | **FIXED** | Was one AA failure at 4.39:1; now **zero** failures across all 12 screens, computed against each element's real resolved background |
| Zoom / reflow | PASS | Clean at 640px (≈200% of 1280) and at 320px (WCAG 1.4.10) |
| Text resize | PASS | Type scale is `rem`-based; `--measure` is in `ch`, so the reading column reflows with text size rather than fighting it |

---

## 6. Regression Results

All re-run fresh **after** every fix in this audit:

| Suite | Result |
|---|---|
| Backend `pytest` | **205 passed** |
| Frontend `tsc -b` | **clean** (exit 0) |
| Frontend `oxlint` | **clean** (exit 0) |
| Frontend `vitest run` | **112 passed** (21 files) — was 109; +3 new regression tests |
| Production build | succeeds — 293.32 kB JS (90.62 kB gzip), 21.84 kB CSS (4.19 kB gzip) |
| Browser console, clean load | **no errors** (verified on a fresh tab) |

**New tests** (following the repo's component/service-test convention — no page tests, per §9 of the handoff):
- `AnswerInput` submits on Enter
- `AnswerInput` does not submit while disabled
- `RequireStudent` offers a recoverable error state when the server is unreachable, and does *not* redirect to the join form

Every fix that could be expressed as a component test now has one. The page-level fixes (N-1, N-2's page states, N-6) are verified by live walkthrough, which is this repo's established practice for pages.

**Manual walkthroughs — all three roles, driven through the real UI:**

- **Anonymous:** Home → Select Chapter (`← Home`) → Linear Equations (`← Chapters`) → Learn (`← Chapter`, correctly *not* "Dashboard") → Start Practice → correctly routed to `/question/…` (anonymous flow, not the session flow) → exited via `← Chapter overview` back to the chapter. Every screen had a way out; the browser Back button was never needed.
- **Student:** Dashboard → Learn (`/topic/…?from=dashboard`, back label correctly "Dashboard") → back → Start Practice → started a session → **answered using Enter only** (`✓ Excellent! You solved it correctly.`) → exited mid-session via the back link → Dashboard showed *Continue where you left off in Rational Numbers?* → Resume → played through to completion → **Session Complete** (score-free in practice mode, correct per the product's coaching philosophy) with one clear exit → Dashboard, resume banner correctly gone, performance badge updated with real recorded attempts.
- **Teacher:** login form (Enter submits; wrong password surfaced `Invalid email or password` with `aria-live="polite"`) → registered → Teacher Home → created a class with a 91-character name via Enter (no overflow) → stress-tested a long unbroken teacher name (Log out stayed on-screen) → Log out → Home.

**Test data:** one throwaway teacher, one class and one student were created on the local dev backend for the walkthroughs and **removed afterwards**. The pre-existing data (`repro@test.com`, `abc@email.com`, class `Class_Test` / `6M3K23`, student `Joiner`) was verified present and byte-identical after cleanup. These files are gitignored, so nothing entered the repo diff. Session and attempt rows for the removed student remain in the gitignored local `runtime.db`; they are inert.

---

## 7. What I could not verify — the honest 12%

The brief asked for confidence, so these are stated plainly rather than buried:

1. **No screenshots, on any screen.** The Browser pane never composited a frame in this environment — every `screenshot` call timed out, exactly as the RC reported. Everything above is measured geometry and computed style. That is strong evidence for overflow, sizing, contrast and structure, and it is **weak evidence for aesthetics**: I cannot certify that anything *looks* right, only that it is positioned, sized and coloured correctly. Someone should look at the app with their eyes before it ships.
2. **No real devices or real browsers.** All measurement was one Chromium engine at synthetic viewports. Genuinely untested: iOS Safari's keyboard/toolbar behaviour and safe-area insets, Android Chrome's URL-bar collapse, real orientation changes, and Firefox/Safari/Edge rendering. The `svh` fix (N-10) is the correct fix by construction but is unverified on a real iPhone. `overflow-wrap: anywhere` and `svh` are both broadly supported; `svh` needs the fallback I added for Safari < 15.4.
3. **Performance was reviewed, not profiled.** I read the render paths — no obvious redundant re-renders, no layout thrashing, `useCallback`/`useMemo` used where they matter, and the React Compiler babel plugin is enabled. I did not run a profiler or measure runtime frame cost. Bundle size is measured and small (90.6 kB gzip). I did not measure the byte delta of my own changes against the RC baseline, so I will not quote one — the added source is one 28-line page plus error-state JSX and ~40 lines of CSS, which cannot be materially significant against 293 kB.
4. **Concurrency and multi-tab** (two tabs in one session, the 409 stale-position path) were exercised only incidentally, not systematically.

Item 1 is the one I would most want closed before a school sees this.

---

## 8. Deferred to Phase 1 (architecture — documented, not implemented)

Per the frozen-architecture constraint, these were found and deliberately **not** acted on:

1. **No length limit on user-supplied names.** `displayName` is a bare `str` in the backend schema; class and teacher names likewise. N-5 makes the UI robust to any length, which is the right frontend fix, but a schema-level `max_length` plus a matching `maxLength` on the inputs is the real fix. **Backend schema change — deferred.**
2. **No "list my classes" endpoint.** A teacher who leaves the page loses the join code permanently; the RC's prominent code card with a save-it-now warning is a mitigation, not a solution. **New API route — deferred.** (Already noted in the handoff §11.6.)
3. **The Session page's `<h1>` is "Practice session" in every mode**, including Test. Cosmetic, but it makes the accessible page title wrong for timed sessions. Fixing it properly means threading mode into the page's heading before the summary call resolves — small, but it touches load sequencing, so it is better done deliberately than in a polish pass.
4. **The Topic explanation loses its section headings** in the export pipeline (`transformTopic` joins bodies and drops titles). The Learn page reconstructs paragraphs but cannot recover headings. **Content-pipeline/schema change — deferred**, and already documented in `TopicPage.tsx`.

---

## 9. Files Changed by This Audit

**New:**
```
frontend/src/pages/NotFoundPage.tsx
docs/Release-0.1.2-Final-Audit.md          (this report)
```

**Modified — behaviour:**
```
frontend/src/App.tsx                              catch-all route
frontend/src/components/RequireStudent.tsx        unreachable-server state (N-2)
frontend/src/components/AnswerInput.tsx           real form, Enter submits (N-4)
frontend/src/components/ChapterCard.tsx           heading semantics (N-9)
frontend/src/components/ChapterPerformanceCard.tsx  h3 -> h2 (N-9)
frontend/src/pages/ChapterSelectionPage.tsx       loading/error/empty (N-6)
frontend/src/pages/ChapterPage.tsx                loading/error split (N-2)
frontend/src/pages/TopicPage.tsx                  load error + retry (N-2)
frontend/src/pages/QuestionPage.tsx               load + submit error (N-2, N-3)
frontend/src/pages/StartPracticePage.tsx          loading/error split, aria-live (N-2, N-11)
frontend/src/pages/TeacherAuthPage.tsx            real forms, aria-live (N-4, N-11)
frontend/src/pages/StudentJoinPage.tsx            real form, aria-live (N-4, N-11)
```

**Modified — styling:**
```
frontend/src/index.css                            overflow-wrap, svh fallback (N-5, N-10)
frontend/src/App.css                              svh, link-button target (N-7, N-10)
frontend/src/components/BackLink.css              44px target (N-7)
frontend/src/components/SessionModeSelector.css   44px radio rows (N-7)
frontend/src/components/DifficultyBadge.css       AA contrast (N-8)
frontend/src/components/ChapterCard.css           title selector (N-9)
frontend/src/pages/DashboardPage.css              flex min-width (N-5)
frontend/src/pages/TeacherAuthPage.css            flex min-width (N-5)
```

**Tests:**
```
frontend/tests/components/AnswerInput.test.tsx       +2
frontend/tests/components/RequireStudent.test.tsx    +1
```

**Backend: zero files touched.**

---

## 10. Final Recommendation

## ⚠ Approve with minor follow-up items

**Approve** — because the three P1 defects are fixed and verified live, the full regression suite is green (205 backend / 112 frontend / clean types / clean lint), the responsive matrix passes at ten widths including two beyond the brief, accessibility now has zero contrast failures and zero undersized targets, and all three role journeys complete end-to-end without ever needing the browser Back button.

**With follow-up** — and not "unconditionally" — for one reason that is not a defect but a gap in evidence: **nobody has looked at this application with their eyes.** Two consecutive automated passes have now certified it without a single screenshot. Everything I can measure is correct; whether it is *beautiful* is genuinely unverified, and "would I show this to a paying school?" is partly an aesthetic question I am not equipped to answer from geometry alone.

**Follow-up items, in priority order:**
1. **Open the app and look at it** — `/chapters`, `/topic/topic-linear-equations-one-variable`, `/practice/rational-numbers`, `/dashboard` and `/teacher`, at ~390px and ~1280px. This is the one thing standing between "measurably correct" and "confidently ready."
2. Check one real iPhone and one real Android device, specifically keyboard-open behaviour on the answer field and the Learn page's scroll.
3. Schedule the four Phase 1 items in §8 — the name-length limit is the one with a real (if low-severity) user impact.

**Nothing is committed.** All changes are working-tree only, awaiting review.
