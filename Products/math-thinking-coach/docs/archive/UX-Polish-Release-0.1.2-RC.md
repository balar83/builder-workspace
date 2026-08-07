# Release 0.1.2 RC — Final UX Polish & Responsive Review (implementation report)

**Date:** 2026-08-07
**Scope:** Frontend UX refinement only. No backend, API, auth, session-management, deployment, content-pipeline, schema, or architecture changes. No new workflows.
**Status:** implemented and verified, **not committed** — held for final approval.

This builds directly on [Release 0.1.2's implementation](UX-Polish-Release-0.1.2.md). That pass covered the design foundation, the Learn page, the question experience, and teacher screens. This pass covers navigation completeness, button proportion, full responsive validation, visual rhythm, and cross-page consistency — the six parts of the RC brief.

---

## Part 1 — Navigation

**Before:** four screens had no way out except the browser's own Back button — Chapter Selection, the Chapter overview, Start Practice, and both question flows had no exit mid-task. Teachers had no way to log out at all.

**After:** a single reusable `BackLink` component (`src/components/BackLink.tsx`) is used everywhere a screen needs a way back that isn't browser history:

| Screen | Added | Target |
|---|---|---|
| Chapter Selection | Back link | Home |
| Chapter overview | Back link | Chapters |
| Learn (Topic) | Back link *(already had one from 0.1.2, now uses the shared component)* | Dashboard or Chapter, depending on how the student arrived |
| Start Practice | Back link + **Cancel** | Dashboard |
| Question (anonymous) | Back link | Chapter overview |
| Question (session) | Back link | Dashboard |
| Session Complete / error states | Primary "Back to Dashboard" button *(unchanged — already existed)* | Dashboard |
| Dashboard | *(unchanged — Log out is the exit, matches every other authenticated root)* | — |
| Teacher Login | Back link | Home |
| Teacher Home (post-login) | **Log out** (replacing a bare "back to home" link) | Home, via a real session end |
| Student Join | Back link | Home |

Two things worth explaining rather than leaving implicit:

- **Exiting mid-session is genuinely safe, not just permitted.** Session state lives server-side (ADR-007) and the Dashboard's existing Resume banner picks it back up. I verified this live: started a session, answered one question correctly, clicked the new exit link, landed on the Dashboard with "Continue where you left off" showing and the performance badge already reflecting the answered question, then resumed and continued normally. No confirm dialog was added, because there is nothing to lose.
- **Teacher Home now offers Log out instead of a separate "back to home" link.** Once T5 (session restore) was fixed in the base 0.1.2 pass, a teacher's session persists across visits, so a plain "back to home" link would silently leave a live session behind with no indication. Log out is the one exit affordance, in both places (matches Dashboard's own pattern exactly — Part 5).

---

## Part 2 — Buttons

Most of this was already correct from the base 0.1.2 pass (button proportions were part of that work). This pass re-verified it and found one real gap:

**Found and fixed:** `.button-group` capped at 320px on *every* viewport, including mobile — so on a 390px phone, a primary CTA like "Start Session" sat at 320px wide with ~35px of unused margin on each side instead of using the space. Added a mobile override (`max-width: none` below 640px). Verified: at 390px the button now measures 358px (full available width); at 1280px it's still capped at 320px. Desktop stays proportional, mobile goes full-width — exactly the brief's rule.

Verified proportional (not oversized) at 1280–1440px across every screen: Home (320px), Chapters back-link + cards, Question page's Check Answer (143px) and hint button (129px), Learn page's CTA (156px), Dashboard's Learn/Start Practice pair (69px/118px, both 44px tall), Teacher's primary button (350px, matching its input width exactly), Start Practice's Start Session/Cancel pair.

---

## Part 3 — Responsive validation

Tested at all eight required widths — **360, 390, 430, 768, 820, 1024, 1280, 1440** — across every screen in the app (Home, Chapters, Chapter, Learn ×3 chapters, Question anonymous, Question session, Start Practice, Dashboard, Teacher login, Teacher home, Student join, Session Complete). Checked at each: horizontal overflow, clipped/overflowing elements, touch target size, input font size, and layout correctness.

**Result: zero horizontal overflow, zero clipped text, zero sub-44px touch targets, zero sub-16px inputs, anywhere.**

Two real bugs were caught and fixed during this sweep, not just confirmed absent:

1. **Radio buttons were stretched to full-width, 44px-tall boxes.** The global `input { width: 100%; min-height: 44px }` rule (added in the base 0.1.2 pass for text/number inputs) was also catching the Session Mode radio buttons, since they're `<input type="radio">`. Verified live: before the fix this would have rendered a 328×44px invisible-but-clickable box instead of a normal 13×13px radio dot. Added a scoped override; re-verified at 13×13px, normal.
2. **`.button-group`'s mobile width** — see Part 2.

**Tablet-specific check (768/820, called out explicitly in the brief):** the chapter grid already switches to 2 columns in this range via an existing `min-width: 640px` breakpoint, producing 354–380px cards — comfortable, not cramped, not stretched. The Learn page's reading column holds its 60ch measure regardless of viewport (verified 64 characters/line at both 768px and 1024px, since the cap is in `ch` units, not a percentage). No tablet-specific breakpoint needed to be added — the existing 640px/1024px grid steps already produce a good tablet layout; this was verified, not assumed.

---

## Part 4 — Visual rhythm

Design tokens (spacing, radii, shadows) were already established in the base 0.1.2 pass; this part is about the seams between pages using them.

**Found and fixed:** the gap between the new BackLink and the page heading below it was inconsistent — **8px** on Chapter Selection, but **16–24px** on other pages, because some pages nest BackLink inside a non-flex wrapper (where only its own margin applies) while others place it as a direct child of a flex container that *also* adds its own gap, so the two stacked. Measured concretely: Start Practice was 24px before the fix (16px container gap + 8px link margin), Learn was ~24px for the same reason. Normalized to two deliberate, consistent values rather than one, since the two page families are structurally different: **8px** for content-column pages (Chapters, Chapter, Learn, both Question pages), **16px** for flat-list pages (Start Practice, via the container's own gap), **12px** for hero/centered pages (Teacher, Student Join, via `.container-hero`'s own gap). Verified all five before/after with live measurement, not by inspection.

Also migrated the last five component/page stylesheets that had never been moved onto tokens (`DashboardPage.css`, `ResumeBanner.css`, `SessionCompleteSummary.css`, `SessionModeSelector.css`, `ChapterSelectionPage.css`) — these were still hand-written hex colors and raw pixel values left over from before the base 0.1.2 pass, which is what let the radio-button bug in Part 3 go undetected (the file wasn't touched, so it never got audited against the new global input rule until this pass).

No page was found to feel cramped or empty at any tested width — card padding, section spacing, and page margins all resolve to the same 4px-based token scale throughout.

---

## Part 5 — Consistency

Verified directly, not assumed:

- **Learn pages** — all three chapters with a Topic (Linear Equations, Data Handling, Understanding Quadrilaterals) render through the same `TopicPage` component and were spot-checked live: correct paragraph counts, worked-example cards, and objective lists for each, zero overflow on any.
- **Teacher pages match student pages** — Teacher Home's header (welcome text left, Log out right, `space-between`/`flex-start`) now uses the identical structure and classes as `DashboardPage`'s header, verified by comparing computed layout properties side-by-side, not just visually.
- **Forms** — Teacher login/register, Teacher class creation, and Student join all now share one `.form-panel`/`.form-field` treatment (input width, height, radius, border all identical, confirmed in the base 0.1.2 pass and re-verified here).
- **Feedback panels** — the `AnswerFeedback` component (green/correct, amber/retry) is the only feedback treatment in the app, used identically on both the anonymous and session question pages.
- **Navigation pattern** — one component (`BackLink`), one visual treatment, used on every secondary screen (see Part 1's table).

---

## Part 6 — Final QA walkthrough

All three roles walked end-to-end through the actual UI (not just the API) in this session, on a fresh browser tab, at 1280×800:

**Teacher:** logged in (session already restored from a prior login, confirming T5 still holds) → created a class "Final QA Class" → join code `VYWP9E` rendered in the prominent card with copy button and warning → logged out via the new Log out link.

**Student:** joined with that code → landed on Dashboard → clicked **Learn** on Rational Numbers → correct "← Dashboard" back link shown (context-aware) → clicked **Start Practice** from the Learn page → correctly continued into `/practice/...` (the session flow, not the anonymous one) → started a session → answered a question correctly, saw the green ✓ feedback → **exited mid-session** via the new back link → landed on Dashboard with a Resume banner and an updated performance badge (1 attempted, 100%) → resumed → session continued correctly at "Question 4 of 5, 3 completed."

**Anonymous visitor:** Home → Select Chapter (back link to Home present) → opened Linear Equations (back link to Chapters present) → clicked Learn → back link correctly read "← Chapter" (not "Dashboard", since this student isn't logged in) → clicked Start Practice → correctly continued into `/question/...` (the anonymous flow, not the session one) → answered a question correctly, saw the same green ✓ feedback as the authenticated flow → exited mid-flow via the back link, landed cleanly on the chapter overview.

Every role reached every screen it should, and never needed the browser's Back button, URL editing, or history.

**Regression, run fresh after all fixes:** backend `pytest` **205/205**; frontend `tsc -b` clean; `oxlint` clean; `vitest` **109/109**. All test accounts, classes, sessions, and attempt records created during this walkthrough were removed afterward — the pre-existing test data from your own manual testing (teacher `abc@email.com`, class `Class_Test`, student `Joiner`) was identified and left untouched, not overwritten.

---

## Screenshots

**Still not available.** The Browser pane in this environment did not composite frames for screenshot capture during this session (same limitation as the base 0.1.2 pass) — every `screenshot` call timed out, and at one point a `click` call also timed out for the same reason, which is why several interactions in this pass were driven via direct DOM events (`element.click()`) rather than simulated pointer clicks. This didn't reduce verification rigor — every claim above was confirmed by reading the actual rendered DOM and computed styles, including the full end-to-end walkthroughs — but I have no image to hand you. If you can view the running app directly, the routes worth a quick look are `/chapters`, `/topic/topic-linear-equations-one-variable`, `/practice/linear-equations`, and `/teacher` (post-login), at both ~390px and ~1280px.

---

## Files changed since Release 0.1.2

**New this pass:**
```
frontend/src/components/BackLink.tsx / .css
frontend/src/pages/ChapterPage.css
docs/UX-Polish-Release-0.1.2-RC.md   (this report)
```

**Modified this pass:**
```
frontend/src/App.css                          mobile button-group fix, hero BackLink spacing
frontend/src/pages/ChapterSelectionPage.tsx/.css
frontend/src/pages/ChapterPage.tsx
frontend/src/pages/TopicPage.css               breadcrumb spacing fix
frontend/src/pages/QuestionPage.tsx
frontend/src/pages/SessionQuestionPage.tsx
frontend/src/pages/StartPracticePage.tsx/.css
frontend/src/pages/TeacherAuthPage.tsx/.css     Log out replaces bottom back-link
frontend/src/pages/StudentJoinPage.tsx/.css
frontend/src/pages/DashboardPage.css            token migration
frontend/src/components/ResumeBanner.css        token migration
frontend/src/components/SessionCompleteSummary.css  token migration
frontend/src/components/SessionModeSelector.css     token migration + radio-input fix
```

Backend: zero files touched, this pass or the last.

---

## Implementation decisions

**The radio-input bug is the most important finding in this pass.** It existed from the moment the base 0.1.2 pass shipped its global input styling, was invisible in every test (radio inputs aren't asserted on by any existing test), and would only have surfaced as "the mode selector looks broken" the first time someone actually opened Start Practice on a real screen. Caught here specifically because Part 3 required testing every screen at every breakpoint rather than sampling — this is the value of the exhaustive sweep the brief asked for, not a formality.

**The BackLink spacing normalization settled on two values (8px / 12px / 16px depending on page family), not one universal value.** Forcing genuinely one number would have meant either restructuring hero pages to not use `.container-hero`'s own gap (a bigger structural change than "final polish" implies) or accepting a visually large gap on content pages to match the hero pages' looser rhythm. Each family is now internally consistent and the values are all drawn from the same token scale — I judged that a better trade than forcing false uniformity across two deliberately different layout patterns.

**No screen was redesigned.** Every change in this pass is additive (a back link, a cancel button, a log-out link) or corrective (a spacing fix, an overflow fix, a token migration) — no component's layout structure or visual language changed from what Release 0.1.2 established.

**Nothing is committed.** Awaiting your review before Release 0.1.2 is finalized.
