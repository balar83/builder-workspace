import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BackLink from '../components/BackLink';
import SessionModeSelector, { type SessionConfig } from '../components/SessionModeSelector';
import { authService } from '../services/authService';
import { questionService } from '../services/questionService';
import { sessionPointerService } from '../services/sessionPointerService';
import { sessionService } from '../services/sessionService';
import type { Chapter } from '../types/chapter';
import type { SessionMode } from '../types/session';
import './StartPracticePage.css';

const DEFAULT_CONFIG: SessionConfig = {
  mode: 'practice',
  difficulty: 'Mixed',
  questionCount: 10,
  timeLimitMinutes: 15,
};

// Self-Serve Learning Loop V1, Slice 1: a Dashboard CTA ("Practise your weak
// areas") can deep-link here with a preselected mode via navigation state -
// the exact same mechanism this page already uses when it navigates onward
// to /session/:sessionId with a shortfallMessage. This reuses the existing
// configuration form/flow rather than bypassing it: the learner still sees
// and can change every field, just starting from Revision instead of the
// generic default.
interface StartPracticeNavigationState {
  presetMode?: SessionMode;
}

export default function StartPracticePage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const presetMode = (location.state as StartPracticeNavigationState | null)?.presetMode;

  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);
  const [config, setConfig] = useState<SessionConfig>(
    presetMode ? { ...DEFAULT_CONFIG, mode: presetMode } : DEFAULT_CONFIG,
  );
  const [maxQuestionCount, setMaxQuestionCount] = useState<number | undefined>(undefined);
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Without this the initial (still-loading) render was identical to the
  // genuine missing-chapter render, so every visit flashed "Chapter not
  // found." before the form appeared.
  const [chapterState, setChapterState] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    questionService
      .getChapter(chapterId)
      .then((result) => {
        if (!cancelled) {
          setChapter(result);
          setChapterState('loaded');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChapterState('error');
        }
      });

    // The chapter's total question count (across all difficulties) - a
    // simple, honest ceiling for "number of questions," not an attempt to
    // predict per-difficulty or Revision availability. A narrower request
    // can still legitimately shortfall; existing messaging already covers that.
    questionService
      .getQuestions(chapterId)
      .then((result) => {
        if (!cancelled) {
          setMaxQuestionCount(result.length);
        }
      })
      .catch(() => {
        // The ceiling is an optional convenience; the chapter fetch above
        // already owns the page's error state.
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  // Clamp down only - runs once when the chapter's count first resolves,
  // so a chapter with fewer questions than the default (10) doesn't start
  // the form in an already-invalid state.
  useEffect(() => {
    if (maxQuestionCount === undefined) {
      return;
    }
    setConfig((previous) =>
      previous.questionCount > maxQuestionCount ? { ...previous, questionCount: maxQuestionCount } : previous,
    );
  }, [maxQuestionCount]);

  const handleSubmit = async () => {
    setValidationError('');
    setSubmitError('');

    if (!Number.isInteger(config.questionCount) || config.questionCount <= 0) {
      setValidationError('Number of questions must be a whole number greater than 0.');
      return;
    }
    if (maxQuestionCount !== undefined && config.questionCount > maxQuestionCount) {
      setValidationError(
        `This chapter has ${maxQuestionCount} question${maxQuestionCount === 1 ? '' : 's'} available — please choose ${maxQuestionCount} or fewer.`,
      );
      return;
    }
    if (config.mode === 'test' && (!Number.isInteger(config.timeLimitMinutes) || config.timeLimitMinutes <= 0)) {
      setValidationError('Time limit must be a whole number greater than 0.');
      return;
    }
    if (!chapterId) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await sessionService.createSession({
        chapterId,
        mode: config.mode,
        difficulty: config.difficulty,
        questionCount: config.questionCount,
        timeLimitMinutes: config.mode === 'test' ? config.timeLimitMinutes : undefined,
      });

      const user = await authService.getCurrentUser();
      if (user?.id) {
        sessionPointerService.setActiveSession({
          studentId: user.id,
          sessionId: response.sessionId,
          chapterId,
          mode: config.mode,
        });
      }

      navigate(`/session/${response.sessionId}`, {
        state: response.shortfall
          ? { shortfallMessage: `Found ${response.actualCount} of ${response.targetCount} questions for this setup.` }
          : undefined,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  if (chapterState === 'loading') {
    return (
      <main className="container">
        <BackLink to="/dashboard" label="Dashboard" />
        <h1>Start Practice</h1>
        <p className="page-lead">Loading…</p>
      </main>
    );
  }

  if (chapterState === 'error') {
    return (
      <main className="container">
        <BackLink to="/dashboard" label="Dashboard" />
        <h1>Start Practice</h1>
        <p className="page-lead">
          We couldn&apos;t load this chapter. Check your connection and try again.
        </p>
        <div className="button-group">
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </main>
    );
  }

  if (!chapter) {
    return (
      <main className="container">
        <BackLink to="/dashboard" label="Dashboard" />
        <h1>Start Practice</h1>
        <p>Chapter not found.</p>
      </main>
    );
  }

  return (
    <main className="container start-practice-page">
      <BackLink to="/dashboard" label="Dashboard" />

      <h1>Start Practice</h1>
      <p className="tagline">{chapter.title}</p>

      <SessionModeSelector value={config} onChange={setConfig} maxQuestionCount={maxQuestionCount} />

      {validationError && (
        <p className="form-error start-practice-error" aria-live="polite">
          {validationError}
        </p>
      )}
      {submitError && (
        <p className="form-error start-practice-error" aria-live="polite">
          {submitError}
        </p>
      )}

      <div className="button-group">
        <button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Starting…' : 'Start Session'}
        </button>
        <button className="link-button" onClick={() => navigate('/dashboard')} disabled={submitting}>
          Cancel
        </button>
      </div>
    </main>
  );
}
