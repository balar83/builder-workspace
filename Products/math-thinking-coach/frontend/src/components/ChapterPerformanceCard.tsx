import { useNavigate } from 'react-router-dom';
import '../components/ChapterCard.css';
import './ChapterPerformanceCard.css';
import type { Chapter } from '../types/chapter';
import type { TopicPerformance } from '../types/performance';

export interface ChapterPerformanceCardProps {
  chapter: Chapter;
  performance?: TopicPerformance;
}

export default function ChapterPerformanceCard({ chapter, performance }: ChapterPerformanceCardProps) {
  const navigate = useNavigate();

  return (
    <div className="chapter-card chapter-performance-card">
      <div className="chapter-card-content">
        <div className="chapter-card-main">
          <h3>{chapter.title}</h3>
          <p className="chapter-desc">{chapter.description}</p>
          {performance && (
            <p className="chapter-progress-badge">
              {performance.questionsAttempted} attempted · {Math.round(performance.accuracy * 100)}% accuracy
              {performance.mastered ? ' · Mastered' : ''}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        className="start-practice-button"
        onClick={() => navigate(`/practice/${chapter.id}`)}
      >
        Start Practice
      </button>
    </div>
  );
}
