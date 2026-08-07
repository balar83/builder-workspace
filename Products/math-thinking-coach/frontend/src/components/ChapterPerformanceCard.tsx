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
}

export default function ChapterPerformanceCard({
  chapter,
  performance,
  topicId,
}: ChapterPerformanceCardProps) {
  const navigate = useNavigate();

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
      </div>
    </div>
  );
}
