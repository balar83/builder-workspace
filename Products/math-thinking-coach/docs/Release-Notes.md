# Release Notes

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
- Configurable timed tests with additional question types (multiple choice, matching, and similar).
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
