# Release Notes

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
