import './AnswerFeedback.css';

export type AnswerFeedbackState = 'checking' | 'correct' | 'retry';

export interface AnswerFeedbackProps {
  state: AnswerFeedbackState;
  message: string;
}

// The coaching message previously rendered with the *same* CSS class as
// the question text — identical colour, size and weight — so the single
// most important moment in the product had no visual presence at all
// (UX review Q3).
//
// A not-yet-correct answer is amber, never red: a first wrong attempt is a
// normal step in the coaching ladder, not an error, and the copy coming
// back from the coach is already encouraging. Red stays reserved for
// genuine system failures.
export default function AnswerFeedback({ state, message }: AnswerFeedbackProps) {
  const icon = state === 'correct' ? '✓' : state === 'retry' ? '↻' : '…';

  return (
    <p className={`answer-feedback answer-feedback-${state}`} aria-live="polite">
      <span className="answer-feedback-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="answer-feedback-message">{message}</span>
    </p>
  );
}
