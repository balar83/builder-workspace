import './SessionCompleteSummary.css';
import type { SessionMode, SessionStatus } from '../types/session';

export interface SessionCompleteSummaryProps {
  mode: SessionMode;
  status: SessionStatus;
  correctCount: number;
  totalCount: number;
}

// Coaching-first, by design (Product-Vision.md's Coaching vs. Assessment
// Philosophy): Practice/Revision never show a number, regardless of how
// well the student did. Test mode is the one, deliberately opted-into,
// self-feedback-framed place a score appears at all. Four distinct
// presentations, not a single generic one - why a session ended matters as
// much as whether it did:
//  - expired only ever happens to a Test-mode session (Practice/Revision
//    have no time limit to expire against), so its score is safe to show.
//  - abandoned can happen to any mode via 4-hour inactivity, so its message
//    stays mode-agnostic and score-free - showing a number here for an
//    abandoned Practice/Revision session would violate the rule above.
//  - completed branches on mode exactly as before: a friendly, no-number
//    message for Practice/Revision, the existing Test summary otherwise.
export default function SessionCompleteSummary({
  mode,
  status,
  correctCount,
  totalCount,
}: SessionCompleteSummaryProps) {
  if (status === 'expired') {
    return (
      <div className="session-complete-summary" aria-live="polite">
        <p className="session-complete-status">Time's up!</p>
        <p className="session-complete-detail">
          This session ended because the time limit was reached. You got {correctCount} of {totalCount} in the time
          you had — a good chance to see what's worth revisiting.
        </p>
      </div>
    );
  }

  if (status === 'abandoned') {
    return (
      <div className="session-complete-summary" aria-live="polite">
        <p className="session-complete-status">Session closed</p>
        <p className="session-complete-detail">
          This session was inactive for a while and closed automatically. Nothing is lost — you can start a new one
          anytime.
        </p>
      </div>
    );
  }

  if (mode === 'test') {
    return (
      <div className="session-complete-summary" aria-live="polite">
        <p className="session-complete-status">Session complete!</p>
        <p className="session-complete-detail">
          You got {correctCount} of {totalCount} — a good chance to see what's worth revisiting.
        </p>
      </div>
    );
  }

  return (
    <div className="session-complete-summary" aria-live="polite">
      <p className="session-complete-status">Nicely done!</p>
      <p className="session-complete-detail">
        You worked through {totalCount} question{totalCount === 1 ? '' : 's'} today. Keep it up!
      </p>
    </div>
  );
}
