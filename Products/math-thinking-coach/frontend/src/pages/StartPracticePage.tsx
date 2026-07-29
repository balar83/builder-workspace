import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SessionModeSelector, { type SessionConfig } from '../components/SessionModeSelector';
import { authService } from '../services/authService';
import { questionService } from '../services/questionService';
import { sessionPointerService } from '../services/sessionPointerService';
import { sessionService } from '../services/sessionService';
import type { Chapter } from '../types/chapter';
import './StartPracticePage.css';

const DEFAULT_CONFIG: SessionConfig = {
  mode: 'practice',
  difficulty: 'Mixed',
  questionCount: 10,
  timeLimitMinutes: 15,
};

export default function StartPracticePage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();

  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    questionService.getChapter(chapterId).then((result) => {
      if (!cancelled) {
        setChapter(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const handleSubmit = async () => {
    setValidationError('');
    setSubmitError('');

    if (!Number.isInteger(config.questionCount) || config.questionCount <= 0) {
      setValidationError('Number of questions must be a whole number greater than 0.');
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

  if (!chapter) {
    return (
      <main className="container">
        <h1>Start Practice</h1>
        <p>Chapter not found.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </main>
    );
  }

  return (
    <main className="container start-practice-page">
      <h1>Start Practice</h1>
      <p className="tagline">{chapter.title}</p>

      <SessionModeSelector value={config} onChange={setConfig} />

      {validationError && <p className="start-practice-error">{validationError}</p>}
      {submitError && <p className="start-practice-error">{submitError}</p>}

      <div className="button-group">
        <button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Starting…' : 'Start Session'}
        </button>
      </div>
    </main>
  );
}
