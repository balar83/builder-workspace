# Release 0.1.2 — UX Polish Sprint (implementation report)

**Date:** 2026-08-07
**Scope:** Frontend UX refinement only. No backend, API, auth, session-management, deployment, content-pipeline, schema or architecture changes. No new features.
**Basis:** the approved [UX Review](UX-Review-Release-0.1.1.md).
**Status:** implemented and verified, **not committed** — held for architectural review.

---

## 1. Summary of UX improvements

Every number below was measured live in the running application, before and after. "Before" figures come from the approved UX review; "after" figures were re-measured on this build.

### Phase A — global design foundation

| Item | Before | After |
|---|---|---|
| **F1** heading line-height | `<h1>` ratio **0.72** — lines physically overlapped (a `font:` shorthand in `:root` locked line-height to a fixed 23.2px that every element inherited) | `h1` 1.15, `h2` 1.25, `h3` 1.3, body 1.6 — each set explicitly, none inherited |
| **F2** text alignment | `#root { text-align: center }` centred *all* body copy, including 705-word passages | Left-aligned by default; centring is now opt-in via `.container-hero` (home, auth, confirmations) |
| **F3** CSS systems | Two contradictory systems: the unmodified Vite starter theme in `index.css` vs. the real theme in `App.css` | Starter theme deleted; one system, `tokens.css` → `index.css` → `App.css` |
| **F4** brand colours | Four unrelated: `#aa3bff`, `#7c3aed`, `#2563eb`, `#3355dd` | One primary (`#7c3aed`) plus semantic success / retry / info / danger tokens |
| **F6** form fields | Styled on session screens, raw browser defaults on teacher screens (166×19px, 13.3px text, `border: inset`, radius 0) | One field style everywhere: 44px min height, 16px text, 8px radius, token border, focus + `aria-invalid` states |
| **F7** input font size | 15.2px (session) / 13.3px (teacher) — both trigger iOS auto-zoom on focus | 16px minimum everywhere |
| **F8** touch targets | Buttons 38px tall | 44–45px; verified **no** non-link button under 44px on any screen |
| **F9** focus styling | 1 custom `:focus` rule in 103; everything else relied on the browser default | One global `:focus-visible` token applied application-wide |
| **F10** heading levels | Learn page ran `h1 → h3`, skipping `h2`; `h3` unstyled at 18.7px vs 16px body | Correct `h1 → h2` sequence; real type steps (34 / 24 / 19px) |

Also delivered as part of Phase A: reusable tokens for **typography, spacing (4px base), colour, borders, radii and shadows** in `src/styles/tokens.css`, and a global `prefers-reduced-motion` guard.

### Phase B — Learn page

| Item | Before | After |
|---|---|---|
| **C1** paragraph structure | **1 paragraph, 705 words / 3,981 chars** | **4 paragraphs**, split on the authored blank lines |
| **C3** readability | Centre-aligned, 76–90 chars/line | Left-aligned, **64 chars/line**, 17px at line-height 1.6 |
| **C4** navigation | None — no back link, no breadcrumb | Context-aware back link ("← Back to dashboard" / "← Back to chapter") |
| **C5** objectives | Flat 11-item bullet list, visually identical to body copy | Checkmark list, spaced, with its own `h2` section |
| **C6** worked example | One unstyled `<p>` | **3 example cards**, each with an accent border, the problem, **9 numbered steps** as a real `<ol>`, and a highlighted answer |
| **C7** heading hierarchy | `h3` 18.7px vs 16px body — a 1.17× step | `h1` 34px → `h2` 24px → body 17px |
| **C8** reading affordances | None | Eyebrow label, read-time estimate, objective count, framed CTA |

### Phase C — question experience

| Item | Before | After |
|---|---|---|
| **Q1** focal point | Question 16.8px/400 centred; the "Your answer" *form label* was 16px/**600** — the label out-ranked the question | Question **22px/500 left-aligned**; label demoted to 14px/500 muted |
| **Q2** progress | 44 non-interactive dots, 118px tall desktop / **286px = 35% of the mobile viewport**; question began 434px down | Slim bar + "Question 7 of 44" + "6 completed" — **36px tall = 4% of viewport**; question now begins at **195px** |
| **Q3** feedback | Reused the *same CSS class* as the question text — correct and incorrect were identical to each other and to the question | Dedicated component: tinted background, accent left border, icon; **green ✓ for correct, amber ↻ for not-yet** |
| **Q4** empty hint panel | Full bordered card reading "No hints revealed yet." before any hint | Renders nothing until the first hint |
| **Q5** hint staging | Flat identical paragraphs | Numbered cards ("Hint 1 of 3"), progressively indented |
| **Q6** stray progress bar | A mis-aligned bar fragment overflowed its container in the hint row | Removed; hint usage is now a plain text counter |
| **Q8** colour hierarchy | Three saturated colours competing (green pill, purple hint, blue submit) | Primary = solid purple (Check Answer); hint = outline secondary; difficulty = muted chip with a colour dot |
| **Q10** vertical alignment | Content vertically centred; question ~280px down on desktop | Top-aligned |

### Phase D — teacher experience

| Item | Before | After |
|---|---|---|
| **T1** inputs | 166×19px, 13.3px text, `border: inset`, radius 0 — half the width of the buttons below them | **350×44px**, 16px text, 8px radius, **width matches the button exactly** |
| **T2** primary vs secondary | "Log In" and "Register" pixel-identical (`rgb(240,240,240)` both) | "Log In" solid primary; "Register" a text link |
| **T3** button spacing | "Create Class" and "Back to Home" flush at **0px gap**, reading as one merged control | **269px** apart; "Back to home" demoted to a text link |
| **T5** session restore | Page load dropped a valid server session back to the login form | Restores via `getCurrentUser()` on mount — verified: reload now lands on "Welcome, …" |

### IA-1 — Learn inside the authenticated flow

Before, `/topic/:topicId` was linked **only** from the anonymous chapter page, so a logged-in student could never reach the lesson content. Now the Dashboard shows a **Learn** action on exactly the chapters that have a Topic (4 of 5 — correctly absent on Practical Geometry), and the journey **Dashboard → Learn → Practice → Session** was walked end to end. The Learn page is context-aware: arriving from the dashboard, "Start Practice" continues into the configured session flow and Back returns to the dashboard; arriving anonymously, both fall back to the previous behaviour.

---

## 2. Screenshots

**Not available for this build.** The Browser pane was not being displayed during implementation, so the page never composited frames and every screenshot attempt timed out. Rather than ship nothing verifiable, verification was done by **measuring computed styles and layout geometry directly in the running page** — which is what produced every before/after number above, and is a stricter check than a visual diff.

Before-state screenshots for the Learn page, question page, teacher login, dashboard and session completion were captured during the UX review and are in that session's record. To produce matching after-shots, display the Browser pane and re-run the walkthrough; the exact routes used were `/topic/topic-understanding-quadrilaterals-polygons-and-properties`, `/question/linear-equations`, `/teacher`, `/dashboard`, `/session/{id}`, at 1280×800 and 375×812.

---

## 3. Files changed

**New (5)**
```
frontend/src/styles/tokens.css              design tokens — the single source of truth
frontend/src/components/AnswerFeedback.tsx  coaching feedback component (Q3)
frontend/src/components/AnswerFeedback.css
frontend/tests/components/AnswerFeedback.test.tsx
docs/UX-Polish-Release-0.1.2.md             this report
```

**Modified — styles (12)**
```
frontend/src/index.css                      Vite starter theme removed; base elements + focus token
frontend/src/App.css                        layout containers, button + field system
frontend/src/components/{AnswerInput,ChapterCard,ChapterPerformanceCard,DifficultyBadge,
                          HintPanel,ProgressBar,QuestionProgress,SolutionPanel}.css
frontend/src/pages/{QuestionPage,SessionQuestionPage,StudentJoinPage,TeacherAuthPage,TopicPage}.css
```

**Modified — components/pages (9)**
```
frontend/src/components/ChapterPerformanceCard.tsx   Learn action (IA-1)
frontend/src/components/DifficultyBadge.tsx          muted chip (Q8)
frontend/src/components/HintPanel.tsx                hide-when-empty + staging (Q4, Q5)
frontend/src/components/QuestionProgress.tsx         bar + count replaces dot grid (Q2)
frontend/src/pages/DashboardPage.tsx                 carries topicId through (IA-1)
frontend/src/pages/HomePage.tsx                      hero container, secondary button
frontend/src/pages/QuestionPage.tsx                  hierarchy, feedback, actions (Q1/Q3/Q6)
frontend/src/pages/SessionQuestionPage.tsx           same, plus visually-hidden h1 (F10)
frontend/src/pages/StudentJoinPage.tsx               shared form panel + field styles
frontend/src/pages/TeacherAuthPage.tsx               T1/T2/T3/T5 + join-code card
```

**Modified — tests (3)** — see §6 for why each changed.
```
frontend/tests/components/HintPanel.test.tsx
frontend/tests/components/QuestionProgress.test.tsx
frontend/tests/components/ChapterPerformanceCard.test.tsx
```

**Backend: zero files touched.**

---

## 4. Accessibility improvements

| Item | Change | Verified |
|---|---|---|
| A1 | All non-link controls now ≥ 44px (WCAG 2.5.5) | No button under 44px on any screen at 375px |
| A2 | Heading sequence corrected — Learn page now `h1 → h2 → h2` | Measured; a visually-hidden `h1` added to the session page, which previously had no `h1` at all |
| A3 | Body copy left-aligned — removes a known barrier for dyslexic and low-confidence readers | `text-align: left` confirmed on all content pages |
| A4 | Error/feedback state no longer conveyed by position alone: icon + colour + border, plus `aria-invalid` styling hook on inputs | Correct = green ✓, not-yet = amber ↻ |
| A5 | `prefers-reduced-motion` guard added — both globally and specifically on the infinite hint-pulse animation | Present in `App.css` and `QuestionPage.css` |
| F9 | One global `:focus-visible` treatment replaces reliance on the browser default | Applied application-wide |
| — | `aria-live="polite"` retained on feedback and hints; `.hint-panel` given an `aria-label` | Confirmed in the new component |
| — | **Contrast measured, not assumed.** The first-pass feedback colours passed AA only marginally (retry 4.51:1, success 4.59:1), so both were darkened before shipping | Re-measured live: **retry 6.37:1, correct 8.30:1, question text 17.74:1, muted label 4.83:1** — all AA, most AAA |

Colour is never the only channel: the difficulty chip carries a dot **and** its text label; feedback carries an icon **and** wording.

---

## 5. Regression testing results

| Suite | Result |
|---|---|
| Backend `pytest` | **205 / 205 passed** — no backend file was touched |
| Frontend `tsc -b` | Clean (exit 0) |
| Frontend `oxlint` | Clean (exit 0) |
| Frontend `vitest` | **109 / 109 passed** (was 102; +3 new AnswerFeedback tests, +2 QuestionProgress, +1 HintPanel, +1 ChapterPerformanceCard) |
| Console errors | None across every route visited |
| Horizontal overflow | None at 375px on any screen |

**Live walkthrough performed:** home → chapter selection → anonymous chapter → Learn page (both new chapters) → anonymous question flow with wrong answer, correct answer and hint reveal → teacher register → teacher login styling → teacher session restore on reload → class creation and join-code card → student join → dashboard → **Learn → Practice → Session** → full 2-question session including wrong-answer and correct-answer feedback → session completion. Desktop (1280×800) and mobile (375×812).

All test data created during verification (teacher, class, student, attempts, sessions) was removed afterwards; `git status` shows no stray data files.

---

## 6. Implementation decisions, and constraints hit

**Three tests were updated.** All three assert behaviour the approved review explicitly asked to change; none were weakened to make a failure disappear:
- `HintPanel.test.tsx` — asserted the "No hints revealed yet." placeholder, which **Q4** removes. Rewritten to assert the panel renders nothing, plus a new test for **Q5** numbering.
- `QuestionProgress.test.tsx` — asserted individual dot contents, which **Q2** removes. Rewritten to assert the count, the completed tally and the bar fill.
- `ChapterPerformanceCard.test.tsx` — extended (not altered) with a test for the **IA-1** Learn action.

**Section headings on the Learn page remain unrecoverable.** The review flagged this as blocked, and it still is: the export pipeline's `transformTopic` joins only each section's `body` and discards `section.title`, so the runtime `Topic.explanation` is a single opaque string. Splitting on the authored blank lines recovers **paragraph** structure — which is what fixed the wall of text — but the four section titles cannot be rendered without a schema and pipeline change, both frozen. Unchanged from the review's assessment; still worth scheduling.

**The Learn page is now taller in absolute pixels, not shorter** — 3,603px vs 2,386px at 1280px wide. This is the correct trade and worth stating plainly: the extra height is proper line-height (1.6 vs 1.45), real paragraph spacing, three structured example cards and spaced objectives. The review's complaint was never raw height; it was 705 undifferentiated centred words. Scanning is what improved, not scroll length.

**`--measure: 68ch` was wrong and was corrected to `60ch`.** `ch` is the width of "0", which is narrower than the average lowercase glyph in a proportional face, so 68ch rendered **76** characters per line — above the 55–75 target. Caught by measuring rather than trusting the unit; 60ch measures 64 characters.

**Two changes went slightly beyond the literal item list, both forced by Phase A.** Making the bare `<button>` element carry the primary style necessarily restyled every page that uses one. Leaving `StudentJoinPage` with two identical purple buttons would have been *worse* than before, so it received the same primary/secondary treatment as the teacher screen (**T2**'s pattern), and its fields were moved onto the shared `.form-panel`. Similarly, `ChapterCard` needed an explicit `text-align: left` because a `<button>` inherits `center` from the UA stylesheet and would otherwise have been the only centred content left in the app. Both are consequences of **F4/F6**, not new scope.

**Deliberately not implemented**, per instruction — all were in the review but outside this sprint: **Q7** (session context header), **Q9** covered only via the motion guard, **S1–S4** (session completion substance), **D1–D5** (dashboard metadata), **F5** dark mode, **F11** persistent header, **T4** full fix, **T6**, **T7**, **IA-2**, **IA-3**, **IA-4**, **A6**.

**One interim mitigation was included** because the review named it as available without architecture change: the teacher join code (**T4**) now renders in a prominent card at 34px with a copy button and an explicit "save this now — it is not shown again" warning. The full fix still needs a "list my classes" endpoint that does not exist.

**Session completion was left alone.** The score-free Practice/Revision message is a documented pedagogical decision, and **S1–S3** were not in scope. Confirmed unchanged in the walkthrough.
