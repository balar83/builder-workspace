# Release Notes

## Content import (2026-08-19) — Squares and Cubes

- Squares and Cubes now has 52 questions (up from 40), added via the same content pipeline as every other chapter expansion. No other change.

## M2 — New question types: multiple choice and select-all (2026-08-17)

*Linear Equations only, in this release. The underlying multiple-choice and select-all engine now exists for any chapter, but content for other chapters hasn't been converted yet.*

### New
- Some Linear Equations questions that used to ask you to type an answer now show you a clear set of choices instead — either pick one (a radio button list) or pick every option that applies (checkboxes). No more guessing whether the app wanted "b", "B", or the full answer typed out by hand.
- Numeric answers in Linear Equations are now accepted in more forms: `1.5`, `1.50`, `6/4`, and `3/2` are all treated as the same correct answer. Nothing that used to be accepted is now rejected — this only widens what's accepted.

### Notes
- This release also laid the technical groundwork (question types, evaluators, matching pipeline and screen changes) that a future release will use to bring the same choice-based question style to other chapters.

## Slice A1 — Structured Learning Content Foundation (2026-08-17)

- Behind-the-scenes groundwork for a future improvement to chapter Learn pages (real section headings instead of one long block of text). No visible change for learners yet — the new structure is in place for one chapter (A Square and A Cube) but the Learn page itself hasn't been updated to use it.

## Curriculum Expansion Milestone (2026-08-15)

### New Content
- A new chapter, **A Square and A Cube** (40 questions, full Learn page), covering squares, square roots, cubes, and cube roots.
- **Rational Numbers** now has 40 questions (up from 5) and a rewritten Learn page.
- **Practical Geometry** now has 35 questions (up from 5) — this chapter still doesn't have a Learn page, by design.

## Release 0.1.2 (2026-08-07) — Design refresh and production readiness

*A frontend-only release: how the app looks and how reliably it behaves, not what it teaches.*

### Improvements
- A refreshed look across the whole app — consistent spacing, colors, and typography (previously a mix of one-off styles), and a rebuilt Learn page.
- One consistent "back" link pattern used on every screen, replacing a mix of inconsistent navigation.
- Checked at 10 different screen sizes, from small phones to desktop.

### Fixes
- 11 issues found and fixed by a dedicated pre-launch review, including: a blank page on a bad URL, a permanent loading spinner if the backend couldn't be reached, pressing Enter not submitting an answer, and some accessibility gaps.
- Two further issues found after launch by hands-on testing and fixed the same day: refreshing or sharing a direct link sometimes 404'd; a session's hint/reveal-solution flow could dead-end without a way forward.

## Release 0.1.1 (2026-08-07) — Curriculum Expansion

*Curriculum expansion and production stabilization only — no architecture, auth, session-management, deployment, or API changes.*

### New Content
- **Data Handling** now has 42 questions (up from 5) and a full Learn page (graphs, pie charts, and probability), covering conceptual understanding, direct application, reasoning, and multi-step problems — not just computation.
- **Understanding Quadrilaterals** now has 40 questions (up from 5) and a full Learn page (polygons, angle sum properties, trapeziums, kites, and parallelograms including rhombus/rectangle/square), authored from scratch with the same depth and hint/misconception structure as Linear Equations and Data Handling.
- Both chapters' questions include progressive hints (never reveal the answer immediately) and Socratic-style guidance, matching the existing coaching philosophy.

### Resolved from v1.0.0-rc1
- The "three chapters still have their original 5 questions" limitation noted below now applies to only one chapter (Practical Geometry).
- Data Handling's already-authored 42-question export (deferred at v1.0.0-rc1 pending content review) is complete: reviewed, approved, and live.

## v1.0.0-rc1 (2026-07-29)

*A Release Candidate — a real, stable checkpoint meant for actual daily use while a few remaining pieces (a fuller session summary, teacher tools) continue to be built separately. Not the final v1.0 tag yet.*

### New Features
- Students can now log in with a class code, name, and PIN and land on a personal Dashboard showing every chapter.
- A full guided practice session: pick a chapter, choose Practice, Revision, or Test mode and a difficulty, and work through a real set of questions one at a time — the same coaching along the way (try again, a hint nudge, then the solution) as before, now inside a proper session with a beginning and an end.
- When a session finishes, students see a clear "Session Complete" screen. Practice and Revision sessions never show a score — only Test mode does, and even then it's framed as a simple self-check, not a grade.
- Closing the app mid-session and coming back later shows a "Continue where you left off" prompt right on the Dashboard, and picks back up at the exact same question.
- A visible "Log out" link, so a shared family device can be handed to the next student cleanly.

### Improvements
- The Dashboard shows real, per-topic progress (questions attempted, accuracy, and a "Mastered" badge) pulled from actual session history, not just what's stored in the browser.
- Configuration mistakes (like an invalid number of questions) are caught immediately, before anything is sent to the server.
- If a chapter doesn't have enough questions for the requested setup, students are told exactly how many were found instead of the session silently coming up short.
- A second browser tab or a lost connection mid-answer resyncs quietly instead of showing a confusing error.

### Known Limitations
- The Session Complete screen is intentionally simple — a fuller breakdown (e.g. which topics to revisit) is planned for a future release.
- Resume only works on the same device/browser a session was started on.
- Three of the five chapters (Understanding Quadrilaterals, Practical Geometry, Data Handling) still have their original 5 questions each.
- No teacher-facing view of student progress yet.

### Deferred Features
- Expanding Data Handling from 5 to 42 already-authored questions — pending a content review pass, not an engineering task.
- A teacher dashboard for viewing class-wide progress.
- Configurable timed tests with additional question types (matching, and similar) — multiple choice and select-all shipped for Linear Equations in the M2 release above; matching and other types remain deferred.
- A more detailed, mode-aware Session Complete summary (topic-level breakdown, suggested next steps).

## 2026-07-27

### New in this release
- The app now remembers where you left off. Close it and come back later, and "Continue Learning" picks up exactly where you were — same chapter, same question.
- Opening a chapter now shows a short overview first — the chapter title, description, and how much you've completed — with a "Start Learning" or "Continue Learning" button, instead of jumping straight into a question.
- Chapters you've made progress in now show how many questions you've completed right on the chapter list, so you can see where you stand at a glance.

## 2026-07-22

### New in this release
- The app now runs on a real backend: chapters and questions are served from a FastAPI API instead of local static data.
- No visible change for learners — chapter selection, hints, and solution reveal all behave exactly as before, now backed by a live API.
- Checking an answer now returns real feedback: learners see a message telling them whether they got it right, and if not, guidance that gets more supportive with each attempt (try again, then a hint nudge, then a nudge toward the solution).
- Getting an answer right now shows a clear "Next Question" button, so learners can move on immediately instead of needing to click through hints or the solution first.
- After a second wrong attempt, the "Need a Hint" button now visually highlights to nudge learners toward using it — hints remain fully optional and available any time.

## 2026-07-09

### New in this release
- Chapters now include multiple questions, and learners can move through them with clear question navigation.
- The question experience now shows progress through the chapter and a completion path when all questions are finished.
- Learners can enter an answer before requesting hints, with clear feedback that evaluation will be available after backend integration.
- A visual question progress indicator helps learners understand which questions are completed, current, and remaining.
