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
// self-feedback-framed place a score appears at all.
export default function SessionCompleteSummary({
  mode,
  status,
  correctCount,
  totalCount,
}: SessionCompleteSummaryProps) {
  const statusMessage =
    status === 'expired'
      ? "Time's up — this session has ended."
      : status === 'abandoned'
        ? 'This session went inactive and was closed. Nothing is lost.'
        : "You've completed this session.";

  return (
    <div className="session-complete-summary" aria-live="polite">
      <p className="session-complete-status">{statusMessage}</p>
      {mode === 'test' ? (
        <p className="session-complete-detail">
          You got {correctCount} of {totalCount} — a good chance to see what's worth revisiting.
        </p>
      ) : (
        <p className="session-complete-detail">
          You worked through {totalCount} question{totalCount === 1 ? '' : 's'} today. Keep it up!
        </p>
      )}
    </div>
  );
}
