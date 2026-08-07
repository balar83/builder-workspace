import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import '../pages/QuestionPage.css';
import './SessionQuestionPage.css';
import AnswerFeedback from '../components/AnswerFeedback';
import AnswerInput from '../components/AnswerInput';
import BackLink from '../components/BackLink';
import DifficultyBadge from '../components/DifficultyBadge';
import HintPanel from '../components/HintPanel';
import QuestionProgress from '../components/QuestionProgress';
import SessionCompleteSummary from '../components/SessionCompleteSummary';
import SolutionPanel from '../components/SolutionPanel';
import { sessionPointerService } from '../services/sessionPointerService';
import { sessionService } from '../services/sessionService';
import type {
  CurrentQuestionResponse,
  SessionMode,
  SessionSummaryResponse,
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

// Test-mode-only metadata needed for the countdown - fetched via the
// existing GET /sessions/{id} (ADR-007's own summary endpoint), never a new
// per-second server call. Re-fetched every time loadCurrentQuestion
// resolves to a real question - the server now records startedAt the
// first time a question is actually served (RC1 polish), so by the time
// this fetch runs it already reflects the true start, with no separate
// refresh needed after a submission.
interface SessionMeta {
  mode: SessionMode;
  timeLimitMinutes: number | null;
  startedAt: string | null;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

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
  const [summary, setSummary] = useState<SessionSummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

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
          // Fetched only now, after current-question has resolved - the
          // server may have just recorded startedAt as a side effect of
          // serving this question (RC1 polish), and this call must land
          // after that, not race it, to reflect the true start.
          sessionService.getSessionSummary(sessionId).then((summaryResult) => {
            if (summaryResult.type === 'ok') {
              setSessionMeta({
                mode: summaryResult.summary.mode,
                timeLimitMinutes: summaryResult.summary.timeLimitMinutes,
                startedAt: summaryResult.summary.startedAt,
              });
            }
          });
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

  // Drives the visible countdown. Stops entirely once the session is
  // already terminal. Reaching zero never ends the session itself - it
  // only asks the server via the existing loadCurrentQuestion() call,
  // which is what actually decides expiry (ADR-007: the server is the
  // sole authority on lifecycle status).
  useEffect(() => {
    if (
      phase.kind === 'terminal' ||
      !sessionMeta ||
      sessionMeta.mode !== 'test' ||
      !sessionMeta.timeLimitMinutes ||
      !sessionMeta.startedAt
    ) {
      setRemainingSeconds(null);
      return;
    }

    const deadline = new Date(sessionMeta.startedAt).getTime() + sessionMeta.timeLimitMinutes * 60_000;
    let expiryChecked = false;

    const tick = () => {
      const secondsLeft = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft <= 0 && !expiryChecked) {
        expiryChecked = true;
        loadCurrentQuestion();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase.kind, sessionMeta, loadCurrentQuestion]);

  // Fires exactly once per session reaching a terminal state, however it
  // got there (a fresh 409 on load, or advancing past the final question).
  // SessionTerminalResponse has no `mode` field, so the mode-aware summary
  // needs this one extra call - and this is also the single place the
  // resume pointer (if any) gets cleared, since a terminal session should
  // never surface a resume banner again.
  useEffect(() => {
    if (phase.kind !== 'terminal' || !sessionId) {
      return;
    }

    let cancelled = false;
    setSummary(null);
    setSummaryError(false);
    sessionPointerService.clearActiveSessionIfMatches(sessionId);

    sessionService
      .getSessionSummary(sessionId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.type === 'ok') {
          setSummary(result.summary);
        } else {
          setSummaryError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummaryError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [phase.kind, sessionId]);

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
    const { status } = phase.terminal;

    return (
      <main className="container">
        <h1>Session Complete</h1>
        {summary ? (
          <SessionCompleteSummary
            mode={summary.mode}
            status={summary.status}
            correctCount={summary.correctCount}
            totalCount={summary.totalCount}
          />
        ) : summaryError ? (
          // No score here, deliberately - the mode is genuinely unknown in
          // this fallback, and "scores hidden by default" is the safer
          // default when it can't be determined, not an edge case to treat
          // casually.
          <p>
            {status === 'expired'
              ? "Time's up — this session has ended."
              : status === 'abandoned'
                ? 'This session went inactive and was closed. Nothing is lost.'
                : "You've completed this session."}
          </p>
        ) : (
          <p>Loading your summary…</p>
        )}
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </main>
    );
  }

  const { position, totalCount, question: content } = phase.question;
  const totalHints = content.hints.length || 1;
  const isAllHintsRevealed = currentHintIndex >= totalHints;
  const isCorrectAnswer = feedback?.coach.nextAction === 'NEXT_QUESTION';
  const isHintSuggested = feedback?.coach.nextAction === 'SHOW_HINT';
  const canRevealSolution = feedback?.ui.canRevealSolution ?? false;
  const isAnswerLocked = feedback !== null && !feedback.ui.canTryAgain;
  const questionEnded = isCorrectAnswer || showSolution;
  const isFinalAdvance = feedback ? feedback.sessionStatus !== 'in_progress' : false;

  const hintButtonLabel =
    currentHintIndex === 0 ? 'Need a Hint' : isAllHintsRevealed ? 'All Hints Revealed' : 'Show Next Hint';

  // Static full-duration display until the countdown actually starts
  // (startedAt is still null pre-first-submission) - never shown for any
  // mode other than Test.
  const displaySeconds =
    remainingSeconds ?? (sessionMeta?.mode === 'test' && sessionMeta.timeLimitMinutes ? sessionMeta.timeLimitMinutes * 60 : null);

  return (
    <main className="container question-page session-question-page">
      <div className="question-header">
        <h1 className="visually-hidden">Practice session</h1>
        {/* Safe to leave mid-session: state lives server-side (ADR-007) and
            the Dashboard's ResumeBanner picks it back up — no confirm
            dialog needed for a non-destructive exit. */}
        <BackLink to="/dashboard" label="Dashboard" />
        <QuestionProgress totalQuestions={totalCount} currentQuestion={position + 1} />
      </div>

      {shortfallMessage && (
        <p className="session-shortfall-notice" aria-live="polite">
          {shortfallMessage}
        </p>
      )}
      {syncNotice && (
        <p className="session-sync-notice" aria-live="polite">
          {syncNotice}
        </p>
      )}

      <section className="question-card">
        <div className="question-card-head">
          <DifficultyBadge level={content.difficulty} />
          {sessionMeta?.mode === 'test' && displaySeconds !== null && (
            <span className="session-timer" aria-live="polite">
              ⏱ {formatCountdown(displaySeconds)}
            </span>
          )}
        </div>

        <p className="question-text">{content.question}</p>

        <AnswerInput
          value={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
          disabled={submitting || isAnswerLocked}
        />

        {(submitting || feedback) && (
          <AnswerFeedback
            state={submitting ? 'checking' : isCorrectAnswer ? 'correct' : 'retry'}
            message={submitting ? 'Checking your answer…' : (feedback?.coach.message ?? '')}
          />
        )}
        {submitError && (
          <p className="session-submit-error" aria-live="polite">
            {submitError}
          </p>
        )}

        {!questionEnded && (
          <div className="question-actions">
            {!isAllHintsRevealed && (
              <button
                className={isHintSuggested ? 'hint-button hint-button-suggested' : 'hint-button'}
                type="button"
                onClick={handleHint}
              >
                {hintButtonLabel}
              </button>
            )}
            {/* Revealing the solution is a purely client-side action — content.solution
                already shipped to the browser with the question, same as the anonymous
                flow's identical button. Gating it on canRevealSolution alone (a server
                flag driven only by wrong-attempt count, independent of hints) left
                students who exhausted all hints without yet racking up 3 wrong attempts
                with neither button visible: a dead end, found in production. Showing it
                once local hints are exhausted restores parity with QuestionPage.tsx,
                which never had this bug. */}
            {(isAllHintsRevealed || canRevealSolution) && (
              <button className="hint-button" type="button" onClick={handleRevealSolution}>
                Reveal Solution
              </button>
            )}

            <span className="hint-counter">
              {currentHintIndex} of {totalHints} hints used
            </span>
          </div>
        )}

        <HintPanel hints={content.hints} currentHintIndex={currentHintIndex} />
        {showSolution && <SolutionPanel solution={content.solution} />}

        {questionEnded && (
          <div className="question-advance">
            <button type="button" onClick={handleNext}>
              {isFinalAdvance ? 'Finish' : 'Next Question'}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
