import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import '../pages/QuestionPage.css';
import './SessionQuestionPage.css';
import AnswerInput from '../components/AnswerInput';
import DifficultyBadge from '../components/DifficultyBadge';
import QuestionProgress from '../components/QuestionProgress';
import { sessionService } from '../services/sessionService';
import type { CurrentQuestionResult } from '../types/session';

interface LocationState {
  shortfallMessage?: string;
}

export default function SessionQuestionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const shortfallMessage = (location.state as LocationState | null)?.shortfallMessage;

  const [result, setResult] = useState<CurrentQuestionResult | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!sessionId) {
      return undefined;
    }

    sessionService
      .getCurrentQuestion(sessionId)
      .then((data) => {
        if (!cancelled) {
          setResult(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loadError) {
    return (
      <main className="container">
        <h1>Session</h1>
        <p>Something went wrong loading this session.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="container">
        <h1>Loading your question…</h1>
      </main>
    );
  }

  if (result.type === 'not-found') {
    return (
      <main className="container">
        <h1>Session</h1>
        <p>This session isn't available.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </main>
    );
  }

  if (result.type === 'terminal') {
    return (
      <main className="container">
        <h1>Session</h1>
        <p>This session has already ended.</p>
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </main>
    );
  }

  const { position, totalCount, question } = result.question;

  return (
    <main className="container question-page session-question-page">
      <div className="question-header">
        <QuestionProgress totalQuestions={totalCount} currentQuestion={position + 1} />
        <div className="meta-row">
          <span className="q-number">
            Question {position + 1} of {totalCount}
          </span>
          <DifficultyBadge level={question.difficulty} />
        </div>
      </div>

      {shortfallMessage && <p className="session-shortfall-notice">{shortfallMessage}</p>}

      <section className="question-card">
        <p className="question-text">{question.question}</p>

        <AnswerInput value="" onChange={() => {}} onSubmit={() => {}} disabled />
        <p className="session-answering-note">Answering questions is coming in the next update.</p>
      </section>
    </main>
  );
}
