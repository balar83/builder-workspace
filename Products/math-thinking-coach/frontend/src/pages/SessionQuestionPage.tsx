import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import '../pages/QuestionPage.css';
import './SessionQuestionPage.css';
import AnswerInput from '../components/AnswerInput';
import DifficultyBadge from '../components/DifficultyBadge';
import HintPanel from '../components/HintPanel';
import ProgressBar from '../components/ProgressBar';
import QuestionProgress from '../components/QuestionProgress';
import SolutionPanel from '../components/SolutionPanel';
import { sessionService } from '../services/sessionService';
import type {
  CurrentQuestionResponse,
  SessionTerminalResponse,
  SubmitSessionAnswerResponse,
} from '../types/session';

interface LocationState {
  shortfallMessage?: string;
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'load-error' }
  | { kind: 'not-found' }
  | { kind: 'terminal'; terminal: SessionTerminalResponse }
  | { kind: 'question'; question: CurrentQuestionResponse };

export default function SessionQuestionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const shortfallMessage = (location.state as LocationState | null)?.shortfallMessage;

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<SubmitSessionAnswerResponse | null>(null);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [submitError, setSubmitError] = useState('');

  // The single entry point back into "what question is current" - used for
  // the initial load, "Next Question", and resyncing after a stale (409)
  // submission. Never trusts a locally-incremented position (ADR-007: the
  // server is the only owner of SessionState).
  const loadCurrentQuestion = useCallback(() => {
    if (!sessionId) {
      return;
    }

    setPhase({ kind: 'loading' });
    setAnswer('');
    setFeedback(null);
    setCurrentHintIndex(0);
    setShowSolution(false);

    sessionService
      .getCurrentQuestion(sessionId)
      .then((result) => {
        if (result.type === 'question') {
          setPhase({ kind: 'question', question: result.question });
        } else if (result.type === 'terminal') {
          setPhase({ kind: 'terminal', terminal: result.terminal });
        } else {
          setPhase({ kind: 'not-found' });
        }
      })
      .catch(() => {
        setPhase({ kind: 'load-error' });
      });
  }, [sessionId]);

  useEffect(() => {
    loadCurrentQuestion();
  }, [loadCurrentQuestion]);

  const handleSubmit = async () => {
    if (phase.kind !== 'question' || !sessionId) {
      return;
    }
    // Duplicate-submission guard: an in-flight request, or a question the
    // server has already moved past (feedback.ui.canTryAgain === false),
    // both block a second submit - independent of whether the button
    // itself is visually disabled.
    if (submitting || (feedback && !feedback.ui.canTryAgain)) {
      return;
    }

    setSyncNotice('');
    setSubmitError('');
    setSubmitting(true);

    try {
      const result = await sessionService.submitSessionAnswer(sessionId, {
        position: phase.question.position,
        answer,
      });

      if (result.type === 'ok') {
        setFeedback(result.response);
      } else if (result.type === 'stale') {
        setSyncNotice('Synced to your latest progress.');
        loadCurrentQuestion();
      } else {
        setPhase({ kind: 'not-found' });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = () => {
    if (phase.kind !== 'question') {
      return;
    }
    const totalHints = phase.question.question.hints.length || 1;
    setCurrentHintIndex((previous) => Math.min(totalHints, previous + 1));
  };

  const handleRevealSolution = () => {
    setShowSolution(true);
  };

  const handleNext = () => {
    loadCurrentQuestion();
  };

  if (phase.kind === 'load-error') {
    return (
      <main className="container">
        <h1>Session</h1>
        <p>Something went wrong loading this session.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </main>
    );
  }

  if (phase.kind === 'loading') {
    return (
      <main className="container">
        <h1>Loading your question…</h1>
      </main>
    );
  }

  if (phase.kind === 'not-found') {
    return (
      <main className="container">
        <h1>Session</h1>
        <p>This session isn't available.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </main>
    );
  }

  if (phase.kind === 'terminal') {
    // Deliberately no score shown here, even as a placeholder - "scores
    // hidden by default" applies regardless of mode, and this page has no
    // way to know the session's mode from a terminal response alone. The
    // real, mode-aware Completion screen is a later sprint's scope.
    const { status } = phase.terminal;
    const statusMessage =
      status === 'expired'
        ? "Time's up — this session has ended."
        : status === 'abandoned'
          ? 'This session went inactive and was closed. Nothing is lost.'
          : "You've completed this session.";

    return (
      <main className="container">
        <h1>Session Complete</h1>
        <p>{statusMessage}</p>
        <p className="session-placeholder-note">A full summary is coming in a future update.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </main>
    );
  }

  const { position, totalCount, question: content } = phase.question;
  const totalHints = content.hints.length || 1;
  const percent = Math.round((currentHintIndex / totalHints) * 100);
  const isAllHintsRevealed = currentHintIndex >= totalHints;
  const isCorrectAnswer = feedback?.coach.nextAction === 'NEXT_QUESTION';
  const isHintSuggested = feedback?.coach.nextAction === 'SHOW_HINT';
  const canRevealSolution = feedback?.ui.canRevealSolution ?? false;
  const isAnswerLocked = feedback !== null && !feedback.ui.canTryAgain;
  const questionEnded = isCorrectAnswer || showSolution;
  const isFinalAdvance = feedback ? feedback.sessionStatus !== 'in_progress' : false;

  const hintButtonLabel =
    currentHintIndex === 0 ? 'Need a Hint' : isAllHintsRevealed ? 'All Hints Revealed' : 'Show Next Hint';

  return (
    <main className="container question-page session-question-page">
      <div className="question-header">
        <QuestionProgress totalQuestions={totalCount} currentQuestion={position + 1} />
        <div className="meta-row">
          <span className="q-number">
            Question {position + 1} of {totalCount}
          </span>
          <DifficultyBadge level={content.difficulty} />
        </div>
      </div>

      {shortfallMessage && <p className="session-shortfall-notice">{shortfallMessage}</p>}
      {syncNotice && <p className="session-sync-notice">{syncNotice}</p>}

      <section className="question-card">
        <p className="question-text">{content.question}</p>

        <AnswerInput
          value={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
          disabled={submitting || isAnswerLocked}
        />

        {(submitting || feedback) && (
          <p className="question-text">{submitting ? 'Checking your answer…' : feedback?.coach.message}</p>
        )}
        {submitError && <p className="session-submit-error">{submitError}</p>}

        <div className="hint-row">
          {questionEnded ? (
            <button className="hint-button" type="button" onClick={handleNext}>
              {isFinalAdvance ? 'Finish' : 'Next Question'}
            </button>
          ) : (
            <div className="session-question-actions">
              {!isAllHintsRevealed && (
                <button
                  className={isHintSuggested ? 'hint-button hint-button-suggested' : 'hint-button'}
                  type="button"
                  onClick={handleHint}
                >
                  {hintButtonLabel}
                </button>
              )}
              {canRevealSolution && (
                <button className="hint-button" type="button" onClick={handleRevealSolution}>
                  Reveal Solution
                </button>
              )}
            </div>
          )}

          <div className="progress-wrap">
            <small>
              {currentHintIndex} / {totalHints} hints used
            </small>
            <ProgressBar percent={percent} />
          </div>
        </div>

        <HintPanel hints={content.hints} currentHintIndex={currentHintIndex} />
        {showSolution && <SolutionPanel solution={content.solution} />}
      </section>
    </main>
  );
}
