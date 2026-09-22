import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ensureLearnerSession } from "../services/ensureLearnerSession";
import { authService } from "../services/authService";
import { progressService } from "../services/progressService";
import { sessionPointerService } from "../services/sessionPointerService";
import { sessionService } from "../services/sessionService";

export default function HomePage() {
  const navigate = useNavigate();
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');

  const [continuePending, setContinuePending] = useState(false);

  // Click-time only: never runs on render, and never creates an identity
  // (no startLearner / ensureLearnerSession). A signed-in student goes to
  // their live session if one exists, otherwise Dashboard; anyone else (or
  // a getCurrentUser failure) keeps the original localStorage behavior.
  const handleContinueLearning = async () => {
    setContinuePending(true);
    try {
      let user;
      try {
        user = await authService.getCurrentUser();
      } catch {
        user = undefined;
      }

      if (user && user.role === 'student') {
        const pointer = sessionPointerService.getActiveSessionFor(user.id);
        if (pointer) {
          try {
            const result = await sessionService.getSessionSummary(pointer.sessionId);
            if (
              result.type === 'ok' &&
              (result.summary.status === 'not_started' || result.summary.status === 'in_progress')
            ) {
              navigate(`/session/${pointer.sessionId}`);
              return;
            }
            sessionPointerService.clearActiveSession();
          } catch {
            // Keep the pointer: a failed lookup says nothing about the session.
          }
        }
        navigate('/dashboard');
        return;
      }

      const lastActiveChapterId = progressService.getLastActiveChapter();
      navigate(lastActiveChapterId ? `/chapter/${lastActiveChapterId}` : "/chapters");
    } finally {
      setContinuePending(false);
    }
  };

  // Smallest discoverable entry point into Dashboard for a self-serve
  // learner (Progress Hub V1): identity is established/reused lazily, only
  // on this explicit click - never merely from viewing Home - reusing the
  // exact pattern already approved for TopicPage's "Start a Tracked
  // Practice Session" CTA.
  const handleMyProgress = async () => {
    setProgressError('');
    setProgressLoading(true);
    try {
      await ensureLearnerSession();
      navigate('/dashboard');
    } catch {
      setProgressError("We couldn't open your progress. Check your connection and try again.");
      setProgressLoading(false);
    }
  };

  return (
    <main className="container container-hero">
      <h1>🧠 Math Thinking Coach</h1>

      <p className="tagline">
        Learn by Thinking, Not Memorizing.
      </p>

      <div className="button-group">
        <button onClick={handleContinueLearning} disabled={continuePending}>Continue Learning</button>

        <button className="btn-secondary" onClick={() => navigate("/chapters")}>
          Select Chapter
        </button>
      </div>

      <p className="home-auth-links">
        <button className="link-button" onClick={handleMyProgress} disabled={progressLoading}>
          {progressLoading ? 'Opening…' : 'My Progress'}
        </button>
        {' · '}
        <button className="link-button" onClick={() => navigate('/student/join')}>
          Join a class
        </button>
        {' · '}
        <button className="link-button" onClick={() => navigate('/teacher')}>
          Teacher login
        </button>
      </p>
      {progressError && (
        <p className="form-error" aria-live="polite">
          {progressError}
        </p>
      )}
    </main>
  );
}