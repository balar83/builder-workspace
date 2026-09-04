import { useNavigate } from 'react-router-dom';
import '../components/ChapterCard.css';
import './ChapterPerformanceCard.css';
import type { Chapter } from '../types/chapter';
import type { TopicPerformance } from '../types/performance';

export interface ChapterPerformanceCardProps {
  chapter: Chapter;
  performance?: TopicPerformance;
  // Present only for chapters that actually have an exported Topic. The
  // Learn action is what puts the lesson inside the authenticated journey
  // (UX review IA-1) — before this, /topic/:topicId was reachable only
  // from the anonymous chapter page, so a logged-in student could never
  // see the teaching content at all.
  topicId?: string;
  // Self-Serve Learning Loop V1, Slice 1: true only when this chapter's
  // topic meets the same weak-topic definition the Revision engine itself
  // uses (learning_context_service.WEAK_ACCURACY_THRESHOLD) - the caller
  // (DashboardPage) computes this from data it already fetches. Undefined/
  // false renders no CTA at all - never a placeholder for "not weak yet."
  hasWeakEvidence?: boolean;
}

export default function ChapterPerformanceCard({
  chapter,
  performance,
  topicId,
  hasWeakEvidence,
}: ChapterPerformanceCardProps) {
  const navigate = useNavigate();

  // Deep-links into the existing Start Practice configuration flow with
  // Revision preselected (StartPracticePage reads this via navigation
  // state) - reuses that page/form entirely, no parallel session path.
  const practiseWeakAreas = () =>
    navigate(`/practice/${chapter.id}`, { state: { presetMode: 'revision' } });

  return (
    <div className="chapter-card chapter-performance-card">
      <div className="chapter-card-content">
        <div className="chapter-card-main">
          {/* h2, not h3: the Dashboard's only other heading is its h1
              welcome, so h3 skipped a level. */}
          <h2>{chapter.title}</h2>
          <p className="chapter-desc">{chapter.description}</p>
          {performance && (
            <p className="chapter-progress-badge">
              {performance.questionsAttempted} attempted · {Math.round(performance.accuracy * 100)}% accuracy
              {performance.mastered ? ' · Mastered' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="chapter-card-actions">
        {topicId && (
          <button
            type="button"
            className="btn-secondary chapter-learn-button"
            onClick={() => navigate(`/topic/${topicId}?from=dashboard`)}
          >
            Learn
          </button>
        )}
        <button
          type="button"
          className="start-practice-button"
          onClick={() => navigate(`/practice/${chapter.id}`)}
        >
          Start Practice
        </button>
        {hasWeakEvidence && (
          <button
            type="button"
            className="btn-secondary chapter-revision-button"
            onClick={practiseWeakAreas}
          >
            Practise your weak areas
          </button>
        )}
      </div>
    </div>
  );
}
