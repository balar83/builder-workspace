import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { progressService } from '../services/progressService';
import { questionService } from '../services/questionService';
import type { AnswerEvaluationResponse } from '../types/answer';
import type { Chapter } from '../types/chapter';
import type { Question } from '../types/question';
import AnswerFeedback from '../components/AnswerFeedback';
import BackLink from '../components/BackLink';
import DifficultyBadge from '../components/DifficultyBadge';
import HintPanel from '../components/HintPanel';
import QuestionProgress from '../components/QuestionProgress';
import QuestionResponseInput from '../components/QuestionResponseInput';
import RemediationPanel from '../components/RemediationPanel';
import SolutionPanel from '../components/SolutionPanel';
import './QuestionPage.css';

export default function QuestionPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);
  const [chapterQuestions, setChapterQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [evaluation, setEvaluation] = useState<AnswerEvaluationResponse | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryToken, setRetryToken] = useState(0);
  // Set once a student-role session (self-serve or class-connected) is
  // confirmed to exist, so identity is checked at most once per page
  // lifetime rather than on every answer submission. Never viewing this
  // page, or viewing it without answering, must not create an identity -
  // this ref is only ever populated from inside ensureLearnerIdentity,
  // which handleAnswerSubmit is the sole caller of.
  const identityEnsuredRef = useRef(false);
  // True only if this page's own ensureLearnerIdentity called startLearner.
  // The saving note is armed at most once, on the first successful
  // evaluation after that, and is never re-armed.
  const createdIdentityRef = useRef(false);
  const savingNoteArmedRef = useRef(false);
  const [showSavingNote, setShowSavingNote] = useState(false);

  const currentQuestion = chapterQuestions[currentQuestionIndex];

  // Establishes a self-serve learner identity lazily, on the learner's
  // first answer submission - never merely from viewing this page. An
  // existing valid session (self-serve or class-connected) is left
  // untouched: getCurrentUser() resolving to a user at all means there is
  // nothing to create. Must be awaited to completion before the answer
  // request is sent (never fired concurrently with it), so the session
  // cookie startLearner() sets is guaranteed present on that first
  // credentialed request - see questionService.submitAnswer.
  const ensureLearnerIdentity = async (): Promise<void> => {
    if (identityEnsuredRef.current) {
      return;
    }

    const user = await authService.getCurrentUser();
    if (!user) {
      await authService.startLearner();
      createdIdentityRef.current = true;
    }

    identityEnsuredRef.current = true;
  };

  useEffect(() => {
    let cancelled = false;

    setChapter(undefined);
    setChapterQuestions([]);
    setCurrentQuestionIndex(0);
    setCurrentHintIndex(0);
    setShowSolution(false);
    setAnswer('');
    setSubmitted(false);
    setAttemptNumber(1);
    setEvaluation(null);
    setSubmitError('');
    setState('loading');

    Promise.all([questionService.getChapter(chapterId), questionService.getQuestions(chapterId)])
      .then(([chapterResult, questionsResult]) => {
        if (!cancelled) {
          setChapter(chapterResult);
          setChapterQuestions(questionsResult);
          setState('loaded');

          if (chapterId && questionsResult.length > 0) {
            const savedIndex = progressService.getChapterProgress(chapterId)?.currentQuestionIndex ?? 0;
            const resumeIndex = Math.min(Math.max(savedIndex, 0), questionsResult.length - 1);
            setCurrentQuestionIndex(resumeIndex);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, retryToken]);

  if (state === 'error') {
    return (
      <main className="container">
        <BackLink to="/chapters" label="Chapters" />
        <h1>Question</h1>
        <p className="page-lead">
          We couldn&apos;t load these questions. Check your connection and try again.
        </p>
        <div className="button-group">
          <button onClick={() => setRetryToken((token) => token + 1)}>Try again</button>
        </div>
      </main>
    );
  }

  if (state === 'loading') {
    return (
      <main className="container">
        <BackLink to="/chapters" label="Chapters" />
        <h1>Question</h1>
        <p className="page-lead">Loading…</p>
      </main>
    );
  }

  if (!chapter || !chapterQuestions.length || !currentQuestion) {
    return (
      <main className="container">
        <BackLink to="/chapters" label="Chapters" />
        <h1>Question</h1>
        <p>Question not found for the selected chapter.</p>
      </main>
    );
  }

  const totalQuestions = chapterQuestions.length;
  const totalHints = currentQuestion.hints.length || 1;
  const isAllHintsRevealed = currentHintIndex >= totalHints;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const isCorrectAnswer = evaluation?.coach.nextAction === 'NEXT_QUESTION';
  const isHintSuggested = evaluation?.coach.nextAction === 'SHOW_HINT';
  // Gating on isAllHintsRevealed alone left a student who racked up wrong
  // attempts without clicking every hint with no way to reveal the
  // solution - a dead end. Matches SessionQuestionPage.tsx's own fix for
  // the identical bug.
  const canRevealSolution = evaluation?.ui.canRevealSolution ?? false;
  const questionEnded = isCorrectAnswer || showSolution;

  const handleHint = () => {
    setCurrentHintIndex((previous) => Math.min(totalHints, previous + 1));
  };

  const buttonLabel =
    currentHintIndex === 0
      ? 'Need a Hint'
      : isAllHintsRevealed
        ? 'All Hints Revealed'
        : 'Show Next Hint';

  const handleSolutionReveal = () => {
    setShowSolution(true);
  };

  const handleQuestionComplete = () => {
    if (chapterId) {
      progressService.recordQuestionCompleted(chapterId, currentQuestion.id);
    }

    if (isLastQuestion) {
      navigate('/chapters');
      return;
    }

    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    setCurrentHintIndex(0);
    setShowSolution(false);
    setAnswer('');
    setSubmitted(false);
    setAttemptNumber(1);
    setEvaluation(null);
    setShowSavingNote(false);

    if (chapterId) {
      progressService.updateCurrentQuestion(chapterId, nextIndex);
    }
  };

  const handleAnswerSubmit = () => {
    setSubmitted(true);
    setSubmitError('');
    // Identity establishment is awaited to completion (never fired
    // concurrently with the answer request) so a fresh learner's session
    // cookie is guaranteed set before submitAnswer sends its credentialed
    // request - otherwise the first Attempt could race the cookie and be
    // silently dropped server-side.
    ensureLearnerIdentity()
      .then(() =>
        questionService.submitAnswer(currentQuestion.id, {
          answer,
          attemptNumber,
          hintsUsed: currentHintIndex,
        }),
      )
      .then((result) => {
        setEvaluation(result);
        setAttemptNumber((previous) => previous + 1);

        if (createdIdentityRef.current && !savingNoteArmedRef.current) {
          savingNoteArmedRef.current = true;
          setShowSavingNote(true);
        }

        if (chapterId) {
          progressService.recordQuestionAttempt(chapterId, currentQuestion.id);
        }
      })
      // Previously unhandled: a failed submission left the feedback panel on
      // "Checking your answer…" permanently, with no error and no way to
      // tell that anything had gone wrong. The session flow already had this
      // branch; the anonymous flow did not. Covers a failed
      // ensureLearnerIdentity() the same way - identity establishment and
      // answer submission share one error path, matching the fact that
      // neither should proceed without the other.
      .catch(() => {
        setSubmitted(false);
        setSubmitError("We couldn't check your answer. Check your connection and try again.");
      });
  };

  return (
    <main className="container question-page">
      <div className="question-header">
        <BackLink to={`/chapter/${chapterId}`} label="Chapter overview" />
        <h1 className="chapter-name">{chapter.title}</h1>
        <QuestionProgress totalQuestions={totalQuestions} currentQuestion={currentQuestionIndex + 1} />
      </div>

      <section className="question-card">
        <div className="question-card-head">
          <DifficultyBadge level={currentQuestion.difficulty} />
        </div>

        <p className="question-text">{currentQuestion.question}</p>

        <QuestionResponseInput
          questionType={currentQuestion.questionType}
          responseSpecification={currentQuestion.responseSpecification}
          value={answer}
          onChange={setAnswer}
          onSubmit={handleAnswerSubmit}
        />

        {submitted && (
          <AnswerFeedback
            state={!evaluation ? 'checking' : isCorrectAnswer ? 'correct' : 'retry'}
            message={evaluation ? evaluation.coach.message : 'Checking your answer…'}
          />
        )}
        {submitError && (
          <p className="form-error question-submit-error" aria-live="polite">
            {submitError}
          </p>
        )}

        {showSavingNote && (
          <p className="question-saving-note" aria-live="polite">
            We&apos;re now saving your practice in this browser.
          </p>
        )}

        {!questionEnded && (
          <div className="question-actions">
            {isAllHintsRevealed || canRevealSolution ? (
              <button className="hint-button" type="button" onClick={handleSolutionReveal}>
                Reveal Solution
              </button>
            ) : (
              <button
                className={isHintSuggested ? 'hint-button hint-button-suggested' : 'hint-button'}
                type="button"
                onClick={handleHint}
              >
                {buttonLabel}
              </button>
            )}

            <span className="hint-counter">
              {currentHintIndex} of {totalHints} hints used
            </span>
          </div>
        )}

        <HintPanel hints={currentQuestion.hints} currentHintIndex={currentHintIndex} />
        {evaluation?.remediation && (
          <RemediationPanel
            why={evaluation.remediation.why}
            remediationHint={evaluation.remediation.remediationHint}
          />
        )}
        {showSolution && <SolutionPanel solution={currentQuestion.solution} />}

        {questionEnded && (
          <div className="question-advance">
            {isLastQuestion ? (
              <>
                <p className="question-complete-note">Chapter complete!</p>
                <button type="button" onClick={handleQuestionComplete}>
                  Return to Chapters
                </button>
              </>
            ) : (
              <button type="button" onClick={handleQuestionComplete}>
                {isCorrectAnswer ? 'Next Question' : 'Mark Question Complete'}
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
