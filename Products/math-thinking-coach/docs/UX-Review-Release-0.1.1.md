# UX Review — Math Thinking Coach

**Reviewer role:** Senior Product Designer / UX Architect
**Date:** 2026-08-07
**Build reviewed:** Release 0.1.1 (curriculum expansion complete, 5 chapters, 2 with Learn content)
**Method:** Live walkthrough of every screen at 1280×800 and 375×812, plus computed-style and DOM measurement. Every number in this document was measured in the running application, not estimated.
**Scope:** User experience only. No code was modified. Backend, APIs, auth, session management, deployment and the content pipeline were treated as frozen; where a recommendation would cross that line, it is marked **[blocked — needs architecture change]** and deferred rather than proposed for this release.

---

## 1. Executive summary

The product **works**. The learning model is sound, the coaching philosophy is coherent, and the content is genuinely good. What is missing is the visual and interaction craft that a school buyer uses as a proxy for trustworthiness.

Right now the application reads as a capable prototype rather than a commercial product. That impression comes from a small number of *systemic* causes, not from hundreds of individual mistakes — which is good news, because roughly 70% of the perceived quality gap can be closed by fixing four things:

| # | Root cause | Blast radius |
|---|---|---|
| 1 | **Two competing CSS systems.** `index.css` is an unmodified Vite starter theme (purple `#aa3bff`, a dark-mode block, `#root { text-align: center }`); `App.css` is the real app theme (`#f5f7fb`, Arial). They contradict each other and neither wins cleanly. | Every screen |
| 2 | **`#root { text-align: center }`** centres *all* body copy application-wide, including 700-word teaching passages. | Every screen |
| 3 | **A `font:` shorthand in `:root`** locks `line-height` to a fixed `23.2px`, inherited by every element regardless of size. `<h1>` at 32px therefore renders at **line-height 0.72 — the lines physically overlap.** | Every multi-line heading |
| 4 | **No design tokens.** Four unrelated brand colours are in use (`#aa3bff`, `#7c3aed`, `#2563eb`, `#3355dd`), spacing is ad hoc, and form controls are styled on some screens and raw browser defaults on others. | Every screen |

Fixing those four costs very little and lifts every screen at once. I would do them before anything else.

**Two findings rise above styling and should be treated as product issues:**

- **The Learn content is unreachable for logged-in students.** `/topic/:topicId` is linked only from the anonymous `/chapter/:chapterId` page. The authenticated journey is Dashboard → `/practice/:chapterId` → `/session/:sessionId`, which never passes through it. The teaching content just authored for two chapters is invisible to the product's primary user.
- **Answer feedback is styled identically to the question text** — literally the same CSS class, same colour, size and weight. In a product whose entire value proposition is coaching, the coaching moment has no visual presence at all.

**Recommended release gate:** ship the Critical items in §3 and §4 before any commercial pilot. The Major items can follow in a 0.1.2 polish pass.

### What is already working — do not regress it

Worth stating plainly, because these are easy to break during a redesign:

- `aria-live="polite"` regions on the feedback and hint panels — screen-reader users are correctly notified. This is better than most products at this stage.
- The answer input is properly associated (`<label for>` ↔ `input id`).
- No horizontal overflow at 375px on any screen tested.
- The Dashboard's responsive card grid (1 / 2 / 3 columns) is well built.
- Keyboard focus is visible (browser default ring) and tab order is logical.
- Suppressing the score in Practice/Revision mode is a deliberate, defensible pedagogical decision, documented in `Product-Vision.md`. **Do not "fix" this.** My recommendations below add *qualitative* substance without adding a score.

---

## 2. Cross-cutting foundations

These are not screen-specific and should be fixed once, centrally.

| # | Issue | Evidence | Severity | Recommendation | User benefit | Complexity |
|---|---|---|---|---|---|---|
| F1 | Headings overlap themselves. `:root { font: 18px/145% }` computes line-height to a fixed `23.2px` that every element inherits. `<h1>` = 32px font / 23.2px line-height. | Measured ratio **0.72**. Visible on the Topic page title at 375px. | **Critical** | Replace the `font:` shorthand with separate `font-family` / `font-size` declarations and set `line-height: 1.5` on `:root`. Give `h1` `line-height: 1.15`, `h2` `1.2`, `h3` `1.3`. | Headlines stop colliding; the app immediately looks professionally typeset. | **Low** (one CSS block) |
| F2 | All body copy is centre-aligned, including long teaching passages. | `#root { text-align: center }` in `index.css`. | **Critical** | Remove it. Set `text-align: left` as the default and centre only deliberately (hero, empty states, completion). | Long-form reading becomes possible; the app stops looking like a landing page. | **Low** |
| F3 | Two conflicting CSS systems; the Vite starter theme was never removed. | `index.css` (purple `#aa3bff`, dark-mode block, `--code-bg`, `#social` rules) vs `App.css` (`#f5f7fb`, Arial). | **Major** | Delete the unused starter theme. Establish one token set: 1 primary, 1 success, 1 warning, 1 danger, a 6-step neutral ramp, and a 4/8px spacing scale. | Visual coherence; far cheaper future changes. | **Medium** |
| F4 | Four unrelated brand colours in simultaneous use. | `#aa3bff` (index.css), `#7c3aed` (hint button), `#2563eb` (progress/Check Answer), `#3355dd` (links). | **Major** | Pick one primary (the Dashboard's purple is the strongest candidate — it already reads as the product's colour) and one accent. Map every other use to semantic tokens. | Brand recognition; reduced cognitive load. | **Low–Medium** |
| F5 | Dark mode is half-implemented and will render broken if triggered. | `index.css` defines a full `prefers-color-scheme: dark` palette; `App.css` hardcodes `body { background: #f5f7fb }` with no dark variant. Card backgrounds are hardcoded `white`. | **Major** | Either complete dark mode with tokens, or remove the dark block entirely. Do not ship it half-done. | Prevents an unreadable screen for users with OS dark mode on — common on school tablets. | **Low** (to remove) / **High** (to complete) |
| F6 | Form controls are styled on some screens, raw browser defaults on others. | Session answer input: 39px tall, rounded, bordered. Teacher login inputs: **166×19px, `font-size: 13.3px`, `border: 1.6px inset`, `border-radius: 0`**. | **Critical** | One `.field` component style applied everywhere: 44px min height, 16px text, 8px radius, token border, visible focus and error states. | Consistency; the teacher screens stop looking unfinished. | **Low** |
| F7 | Input font-size below 16px causes iOS to auto-zoom on focus. | Session input **15.2px**; teacher inputs **13.3px**. | **Major** | Set all inputs to `font-size: 16px` minimum. | Removes a jarring zoom-and-reflow on every tap on iPad/iPhone — the most common school device. | **Low** |
| F8 | Interactive targets below the 44px minimum (WCAG 2.5.5 / Apple HIG). | "Check Answer" and "Need a Hint" measured **38px tall** at 375px. | **Major** | 44px minimum height on all buttons and inputs. | Fewer mis-taps for younger students and users with motor-control differences. | **Low** |
| F9 | Focus styling relies entirely on the browser's default ring; only one custom `:focus` rule exists in the whole app. | 1 of 103 CSS rules (`.chapter-card:focus`). | **Minor** | Define one `:focus-visible` token and apply it globally. | Consistent, on-brand keyboard navigation. | **Low** |
| F10 | Heading levels skip (`h1` → `h3`), and `h3` is unstyled at browser-default 18.7px — barely larger than 16px body text. | Topic page heading sequence: `H1, H3, H3`. | **Major** | Use `h2` for section headings and give it a real type step (e.g. 24px/600 with generous space above). | Correct document outline for screen readers; visible section structure for sighted users. | **Low** |
| F11 | No persistent application chrome. No header, logo, breadcrumb or nav landmark on any screen. | `nav: 0, header: 0, footer: 0` across all pages. | **Major** | Add a slim persistent header: logo, current context (chapter/session), and account menu. | Users always know where they are and how to leave; the product feels like an application rather than a set of pages. | **Medium** |

---

## 3. Chapter Content page (Topic / "Learn") — the priority rebuild

**Route:** `/topic/:topicId` · **Component:** `TopicPage.tsx` (60 lines) + `TopicPage.css` (**3 lines**)

This is the weakest screen in the product, and the gap between the quality of the *content* and the quality of its *presentation* is the single most damaging thing a prospective school buyer would see. The content is genuinely strong. The page actively works against it.

### 3.1 Measured state (Understanding Quadrilaterals)

| Metric | Measured | Should be |
|---|---|---|
| Explanation rendered as | **1 single `<p>`** | 4 titled sections |
| Word count in that one paragraph | **705 words / 3,981 chars** | ≤150 words per block |
| Text alignment | **centre** | left |
| Line length | 43–90 characters depending on viewport | 55–75 |
| Page height (desktop) | 2,386px = **3.4 screens** | ~2 screens, scannable |
| Page height (mobile) | 3,546px = **4.4 screens**, incl. 1,879px of unbroken centred prose | — |
| Section headings shown | **0** | 4 |
| Back / breadcrumb navigation | **none** | present |
| Dedicated CSS | **3 lines** | a real stylesheet |
| Heading hierarchy | `h1` → `h3` (skips `h2`) | `h1` → `h2` |

### 3.2 Current issues

| # | Issue | Severity |
|---|---|---|
| C1 | **The entire multi-section explanation renders as one 705-word centred paragraph.** The pipeline joins sections with `\n\n`, but `<p className="tagline">` has no `white-space` handling, so every paragraph break collapses. There is no visual entry point anywhere in four screens of text. | **Critical** |
| C2 | **Section titles are absent.** `transformTopic` maps only `section.body` into the runtime record; `section.title` is discarded at export. The runtime `Topic.explanation` is a single opaque string, so the frontend has nothing to render as a heading. | **Critical** |
| C3 | **Centred body text.** The worst possible alignment for sustained reading — every line starts at a different x-position, so the eye must re-acquire the line start on every return sweep. Compounded by dyslexia and by low reading confidence, both over-represented in the target audience. | **Critical** |
| C4 | **No navigation.** No back link, no breadcrumb, no chapter context. The only exit is the browser back button or "Start Practice". | **Major** |
| C5 | **Learning Objectives are a flat 11-item bullet list**, visually identical to body text, with no grouping — even though the source data groups them into 4 named sections. | **Major** |
| C6 | **The worked example is undifferentiated from prose.** It is the single most valuable teaching artefact on the page and is presented as an unstyled `<p>` (it does at least retain `white-space: pre-line`, so its line breaks survive — the only piece of formatting on the page that works). | **Major** |
| C7 | **`h3` at 18.7px against 16px body** provides almost no hierarchy signal — a 1.17× step where 1.5× is the minimum for a perceptible level change. | **Major** |
| C8 | **No reading affordances**: no estimated read time, no progress indicator, no section anchors, no way to skip to practice from the top. | **Minor** |
| C9 | **The page is orphaned from the authenticated journey** (see §8, IA-1). Logged-in students cannot reach it at all. | **Critical** |

### 3.3 Recommended redesign

**Layout — a single readable column, left-aligned, with real structure:**

```
┌──────────────────────────────────────────────┐
│ ← Understanding Quadrilaterals    [ header ] │   persistent chrome (F11)
├──────────────────────────────────────────────┤
│                                              │
│  Polygons and Their Properties        [h1]   │   left-aligned, line-height 1.15
│  4 sections · about 6 min read               │   meta line, muted
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ On this page                           │  │   jump links — 4 items
│  │ · Polygons: curves, convexity …        │  │   (recovers scannability)
│  │ · Angle sum property                   │  │
│  │ · Trapezium and kite                   │  │
│  │ · Parallelograms and special cases     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Polygons: curves, convexity …        [h2]   │   24px/600, 40px space above
│  Body copy, left-aligned, max-width 68ch,    │
│  16–17px, line-height 1.6, paragraphs        │
│  broken every 3–4 sentences.                 │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ✎ Worked example                       │  │   tinted card, accent left border
│  │ Problem …                              │  │
│  │ Step 1 …  Step 2 …                     │  │   steps as a numbered list
│  │ ✓ Answer: …                            │  │   answer visually resolved
│  └────────────────────────────────────────┘  │
│                                              │
│  … remaining sections …                      │
│                                              │
│  What you should be able to do        [h2]   │   objectives, grouped by section
│  ✓ …   ✓ …                                   │   checkmark list, not bullets
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Start Practice  →     40 questions    │  │   sticky on mobile
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Typography spec:**

| Element | Size | Weight | Line-height | Align |
|---|---|---|---|---|
| Page title (`h1`) | 34px (28px mobile) | 600 | 1.15 | left |
| Section heading (`h2`) | 24px (21px mobile) | 600 | 1.25 | left |
| Body | 17px (16px mobile) | 400 | **1.6** | left |
| Worked-example steps | 16px | 400 | 1.7 | left |
| Meta / read time | 14px | 500 | 1.4 | left |

**Measure:** `max-width: 68ch` on the content column, centred *as a block* on the page — the column is centred, the text inside it is not.

**Spacing rhythm (8px base):** 40px above `h2`, 12px below `h2`, 20px between paragraphs, 32px around the worked-example card, 48px above the CTA.

### 3.4 Sequencing — what is achievable now vs. later

| Step | Change | Blocked? | Complexity |
|---|---|---|---|
| 1 | Remove centring, set measure, fix line-height, add type scale and spacing | No | **Low** |
| 2 | Split `explanation` on `\n\n` and render one `<p>` per paragraph | No — frontend only | **Low** |
| 3 | Style the worked example as a card; group and check-mark the objectives; add back-nav and read-time | No | **Medium** |
| 4 | **Restore section titles as real `h2` headings** | **[blocked — needs architecture change]** `Topic.explanation` is a single string; titles are dropped by the export pipeline. Requires a schema + pipeline change, both frozen. | **Medium**, next release |
| 5 | Add "On this page" jump links | Depends on step 4 | **Low**, once 4 lands |

**Steps 1–3 alone resolve C1, C3, C4, C5, C6, C7 and most of C8** — that is the great majority of the damage, with no architecture change and no content re-authoring. I would not delay the rebuild waiting for step 4.

> **Note for the next release plan:** step 4 is the one place where a frozen-architecture constraint is materially capping UX quality. Widening `Topic.explanation` from `str` to a list of `{title, body}` sections is a small, additive, backward-compatible change and would unlock a genuinely well-structured Learn experience. Worth scheduling deliberately.

---

## 4. Question page & session flow

**Routes:** `/question/:chapterId` (anonymous) and `/session/:sessionId` (authenticated). These are two separate components presenting near-identical UI — see IA-2.

| # | Issue | Evidence | Severity | Recommendation | User benefit | Complexity |
|---|---|---|---|---|---|---|
| Q1 | **Visual hierarchy is inverted — the question is the least prominent element on the page.** | Question: 16.8px, weight **400**, centred, 23px tall. The "Your answer" *form label*: 16px, weight **600**. The progress dot grid: **118px tall**. The question is out-ranked by a form label and by a decorative control. | **Critical** | Question becomes the hero: 22–24px, weight 500, left-aligned, top of card. Demote "Your answer" to a 14px muted label or remove it (the placeholder already says it). | Students read the question first. Sounds obvious; currently untrue. | **Low** |
| Q2 | **The 44-dot progress grid dominates the screen and is not interactive.** | 44 non-clickable `<div>`s. Desktop: 681×118px in the prime slot above the question. Mobile: **286px tall = 35% of the viewport**; the question does not begin until **434px** down an 812px screen. | **Critical** | Replace with a slim bar + "Question 7 of 44" + a small "12 completed" count. If per-question navigation is genuinely wanted, make it a collapsible drawer — and make the dots clickable, since a 44-item grid that cannot be used for navigation is pure cost. | Recovers a third of the mobile viewport; the question is immediately visible without scrolling. | **Low** |
| Q3 | **Answer feedback has no visual treatment whatsoever.** | "Not quite. Try solving it once more…" renders with the **same CSS class as the question text** (`.question-text`) — measured identical colour `rgb(107,99,117)`, size 16.8px, weight 400, no background, no border, no icon. Correct and incorrect states are visually identical to each other *and* to the question. | **Critical** | Give feedback a dedicated component: coloured left border + tinted background + icon. Success = green/✓; not-yet = amber/↻ (**not** red — this is a coaching product, and the copy is already correctly encouraging; the styling should match that tone). Add `aria-invalid` on the input. Keep the existing `aria-live`. | The single most important moment in the product becomes legible at a glance. Directly serves the coaching philosophy. | **Low** |
| Q4 | **The empty hint panel occupies permanent space to say nothing.** | "Hints — No hints revealed yet." renders a full bordered card before any hint is requested. | **Major** | Render nothing until the first hint is revealed; let the panel animate in. | Less noise; more focus on the question. | **Low** |
| Q5 | **Revealed hints are not visually staged.** All hints render as identical flat text, so a student cannot see they are progressing through a deliberate 3-step ladder. | — | **Major** | Number them ("Hint 1 of 3"), indent progressively or stack as cards, and keep the counter prominent. Consider a brief pause before the next hint unlocks. | Makes the Socratic ladder legible — the pedagogy becomes visible rather than implicit. | **Medium** |
| Q6 | **A stray progress-bar fragment renders mis-aligned** beneath the hint counter, overflowing its container edge and appearing clipped/broken. | `.progress-wrap` (220px) inside the hint row; visible as a floating blue sliver in every screenshot. | **Major** | Remove it or integrate it properly into the hint counter. | Removes a visible "this is broken" artefact. | **Low** |
| Q7 | **The session screen shows no context and offers no exit.** | No chapter name, no mode indicator, no timer (even in Test mode), no "back to dashboard". | **Major** | Add a session header: chapter · mode · progress · exit. | Students know what they are in and can leave without abandoning via the browser. | **Medium** |
| Q8 | **Three saturated colours compete inside one small card** — green "Easy" pill, purple "Need a Hint", blue "Check Answer" — with no meaning attached to the difference. | — | **Major** | Primary action (Check Answer) = solid primary. Hint = secondary/outline. Difficulty = muted neutral chip, not a saturated pill. | The eye goes to the primary action. | **Low** |
| Q9 | The pulsing hint-button animation after a second wrong attempt has no `prefers-reduced-motion` guard. | `@keyframes hint-suggested-pulse`, infinite. | **Minor** | Wrap in `@media (prefers-reduced-motion: no-preference)`. | Accessibility for motion-sensitive users. | **Low** |
| Q10 | Massive dead space above the card; content is vertically centred, so the question sits ~280px down on desktop. | `.container { justify-content: center }` | **Minor** | Top-align session and content pages. | More content above the fold. | **Low** |

---

## 5. Session completion

| # | Issue | Severity | Recommendation | User benefit | Complexity |
|---|---|---|---|---|---|
| S1 | **The screen carries almost no information.** "Nicely done! You worked through 2 questions today." — no indication of which topics were strong or shaky, no hints-used summary, no time spent. A student learns nothing from having finished. | **Major** | Keep Practice mode score-free (correct per Product Vision) but add *qualitative* substance: "You worked through 8 questions on Parallelograms and Kites. You used hints on 3 — want to revisit *Kite diagonals*?" This reinforces coaching without introducing a grade. | The end of a session becomes a learning moment rather than a full stop. | **Medium** |
| S2 | **No sense of achievement.** No icon, illustration, colour, or motion. The visual weight of finishing is lower than that of a single question. | **Major** | A restrained celebration: a checkmark badge, the chapter name, session stats in a light card. Avoid confetti — this audience skews older than gamified primary apps. | Motivation and session-completion rates. | **Low–Medium** |
| S3 | **Dead end.** "Back to Dashboard" is the only action, styled as a neutral grey button. | **Major** | Offer a primary "Practice again" and a secondary "Back to Dashboard"; if the chapter has Learn content, offer "Review the lesson". | Keeps students in a learning loop instead of ejecting them. | **Low** |
| S4 | The completion card is narrower than the content column above it and does not align to any grid. | **Minor** | Align to the same column width as the session card. | Visual coherence. | **Low** |

---

## 6. Dashboard

The strongest screen in the product — real cards, left-aligned header, a working responsive grid, and a clear primary action. The issues below are refinements, not a rebuild.

| # | Issue | Evidence | Severity | Recommendation | User benefit | Complexity |
|---|---|---|---|---|---|---|
| D1 | **Chapter cards carry no metadata.** A student cannot distinguish Rational Numbers (5 questions, placeholder content) from Linear Equations (44 questions, full Topic). All five cards look equally substantial. | — | **Major** | Show question count, whether a Learn lesson exists, and an estimated time on every card. Visually de-emphasise chapters that are still placeholders. | Students choose meaningfully instead of guessing; sets correct expectations. | **Low** |
| D2 | **Mixed alignment inside a single card** — title centred, description centred, button left-aligned. | Measured across all 5 cards. | **Major** | Left-align everything in the card. | Cleaner, more professional; easier to scan a column of cards. | **Low** |
| D3 | **Performance data appears only after a first attempt**, so a new student sees five identical, information-free cards. | — | **Minor** | Show a "Not started" state explicitly rather than showing nothing. | Clearer progress model. | **Low** |
| D4 | "Log out" is a small underlined blue link, the only navigation on the page, and the only blue element in a purple UI. | `#3355dd` vs primary purple. | **Minor** | Move into the account menu in the persistent header (F11). | Consistency; less accidental prominence for a destructive-ish action. | **Low** (with F11) |
| D5 | No greeting hierarchy or sense of "what should I do next" — five equal-weight cards with no recommendation. | — | **Minor** | Surface a single "Continue where you left off" or "Recommended next" card above the grid. The resume pointer already exists. | Reduces decision cost at the start of every session. | **Medium** |

---

## 7. Teacher pages

**This is the weakest area relative to commercial expectations.** It is also the first screen a school administrator or head of department sees during an evaluation. In its current state it would materially damage a sales conversation.

| # | Issue | Evidence | Severity | Recommendation | User benefit | Complexity |
|---|---|---|---|---|---|---|
| T1 | **Login form uses raw, unstyled browser inputs.** | Measured **166×19px**, `font-size: 13.3px`, `border: 1.6px inset`, `border-radius: 0` — while buttons on the same screen are 320×46px with a 10px radius. The inputs are **half the width and 41% the height** of the buttons directly beneath them, producing a visibly broken left edge. | **Critical** | Apply the shared `.field` style (F6). Match input width to button width. | The product stops looking unfinished at the exact moment a buyer is forming a first impression. | **Low** |
| T2 | **Primary and secondary actions are visually identical.** | "Log In" and "Need an account? Register" measured with identical `background: rgb(240,240,240)` — confirmed programmatically. | **Critical** | "Log In" = solid primary button. "Register" = text link beneath. | Users stop hesitating over which control to press. | **Low** |
| T3 | **"Create Class" and "Back to Home" are flush against each other with zero gap**, reading as one merged control. | Measured `gap: 0px` between the two 46px buttons (they sit in different containers, so `.button-group { gap: 16px }` never applies). | **Major** | Separate them; make "Create Class" primary and "Back to Home" a text link. | Removes a genuine misclick hazard. | **Low** |
| T4 | **A teacher cannot see the classes they have created.** After creating a class and re-logging in, the class list is empty — the join code is displayed exactly once, at creation, and is then unrecoverable through the UI. | Verified: created "UX Review Class" (code `CTYHJB`), logged out, logged back in — no class shown anywhere. | **Critical** *(product)* | **[blocked — needs architecture change]** Requires a "list my classes" endpoint, which does not exist (already a known gap in `HANDOFF_PROMPT.md` §11.6). **Interim mitigation available now:** make the post-creation join code far more prominent, with a copy button and an explicit "save this now — you will need it to add students" warning. | Prevents permanent loss of the code that is the sole route for students to join. | Interim **Low**; full fix **Medium**, next release |
| T5 | **The teacher session is not restored on page refresh.** `TeacherAuthPage` holds identity in React state only and never calls `getCurrentUser()` on mount, so a refresh drops back to the login form despite a valid server session. | Verified: `/auth/me` returned `role: teacher` while the UI displayed the login form. The student side does this correctly (`RequireStudent`, `DashboardPage`). | **Major** | Call `getCurrentUser()` on mount, mirroring the student pattern. Frontend-only — no auth or session change. | Teachers stop being logged out by an accidental refresh. | **Low** |
| T6 | **The teacher experience is a single text field.** No roster, no class-progress view, no student list, no export. | Full page text: "Welcome, X / New class name / Create Class / Back to Home". | **Major** *(product)* | Out of scope for a UX pass, but this should be named explicitly in roadmap terms: **there is currently no teacher value proposition in the product.** Everything a teacher can do is create a join code. | Honest scoping — this is the gap between "student tool" and "school product". | **High**, own milestone |
| T7 | No branding, product name, or "back to home" on the login screen. | — | **Minor** | Add logo and product name. | Trust and orientation. | **Low** |

---

## 8. Information architecture & navigation

| # | Issue | Evidence | Severity | Recommendation | User benefit | Complexity |
|---|---|---|---|---|---|---|
| IA-1 | **Logged-in students cannot reach the Learn content.** `/topic/:topicId` is linked only from `ChapterPage.tsx` (the anonymous `/chapter/:chapterId` route). The authenticated path — Dashboard → `/practice/:chapterId` → `/session/:sessionId` — never touches it. | Verified by route and link audit. | **Critical** | Add a "Learn first" / "Read the lesson" action to Dashboard chapter cards and to the session-configuration screen, for any chapter with a Topic. Frontend routing only. | **Unlocks content that already exists and is currently invisible to the primary user.** Highest value-per-effort item in this review. | **Low** |
| IA-2 | **Two parallel practice systems with near-identical UI.** Anonymous `/question/:chapterId` (localStorage progress, all 44 questions, dot grid) and authenticated `/session/:sessionId` (server sessions, selected subset). Two components, two progress models, no explanation to the user. | — | **Major** | Long-term, converge on one. Short-term, differentiate them in the UI so the difference is intelligible ("Free practice" vs "Guided session"). | Removes a conceptual split users cannot see but do feel. | **Medium** (label) / **High** (converge) |
| IA-3 | **No global navigation or breadcrumbs anywhere.** | `nav: 0, header: 0` on every page. | **Major** | Persistent header (F11) plus breadcrumbs on Topic and Question pages. | Orientation and escape routes on every screen. | **Medium** |
| IA-4 | **Anonymous and authenticated modes are never explained.** A student can practise anonymously with localStorage progress and separately log in for server-tracked progress; nothing tells them these are different or that anonymous progress will not follow them. | — | **Minor** | A short explanatory line on the home screen and a prompt to log in for saved progress. | Prevents lost work and confused expectations. | **Low** |

---

## 9. Accessibility summary

Assessed against WCAG 2.1 AA.

**Passing / already good:** colour contrast on body text (measured ≈**6.9:1** for `#555` on `#f5f7fb`, ≈**4.8:1** for `#6b7280` on white — both pass AA); `aria-live="polite"` on feedback and hint panels; `<label for>` correctly associated with the answer input; `aria-label="Question progress"` on the dot grid; logical tab order; visible (default) focus ring; `lang="en"` set; no horizontal overflow at 375px.

**Needs work:**

| # | Issue | Severity | Recommendation | Complexity |
|---|---|---|---|---|
| A1 | Touch targets 38px, below the 44px minimum (WCAG 2.5.5). | **Major** | 44px minimum. | **Low** |
| A2 | Heading levels skip `h1` → `h3` on the Topic page. | **Major** | Use `h2`. | **Low** |
| A3 | Centred body text is a recognised barrier for dyslexic and low-confidence readers. | **Major** | Left-align (F2). | **Low** |
| A4 | Error state conveyed by text position alone — no `aria-invalid`, no icon, no colour, no border change. | **Major** | Add `aria-invalid` and a non-colour-dependent indicator (icon + text). | **Low** |
| A5 | Infinite pulse animation with no `prefers-reduced-motion` guard. | **Minor** | Add the guard. | **Low** |
| A6 | No skip-to-content link. | **Minor** | Add one with the persistent header. | **Low** |
| A7 | Half-implemented dark mode risks unreadable colour combinations if the OS preference is set. | **Major** | Complete or remove (F5). | **Low**/**High** |

---

## 10. Recommended sequencing

**Phase 1 — Foundations (½–1 day, unlocks everything else)**
F1 line-height · F2 remove centring · F6 unified field style · F7 16px inputs · F8 44px targets · F10 heading levels · F5 remove or finish dark mode

**Phase 2 — Critical screen fixes (2–3 days)**
Q3 feedback styling · Q1 question hierarchy · Q2 replace dot grid · IA-1 expose Learn content · T1/T2 teacher login · T4 join-code prominence · T5 teacher session restore

**Phase 3 — Chapter Content rebuild (2–3 days)**
§3.3 steps 1–3 in full

**Phase 4 — Polish (3–5 days)**
F3/F4 design tokens · F11 persistent header · S1–S3 completion screen · D1/D2 dashboard cards · Q4–Q8 session refinements

**Deferred to next release (architecture change required)**
Section titles in `Topic.explanation` (§3.4 step 4) · teacher "list my classes" endpoint (T4) · teacher roster and progress views (T6) · convergence of the two practice systems (IA-2)

---

## 11. Closing assessment

The product is **pedagogically ahead of its presentation**. The content model, the coaching ladder, the deliberate refusal to show scores in Practice mode — these are considered decisions that many commercial competitors get wrong, and they should be protected through any redesign.

What stands between this and a product a school would pay for is roughly **8–12 days of focused design and frontend work**, most of it low-complexity, and almost none of it requiring the frozen architecture to move. The two exceptions — section titles in the Topic model, and teacher visibility into classes — are worth scheduling deliberately in the next release rather than worked around.

If only one thing is done before a pilot, it should be **IA-1**: the Learn content that Release 0.1.1 just added for two chapters cannot currently be reached by a logged-in student. That is a routing fix measured in hours, and without it the release's headline achievement is invisible to the people it was built for.
