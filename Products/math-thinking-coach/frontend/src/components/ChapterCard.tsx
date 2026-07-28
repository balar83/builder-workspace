import { useNavigate } from 'react-router-dom';
import { progressService } from '../services/progressService';
import type { Chapter } from '../types/chapter';
import './ChapterCard.css';

export default function ChapterCard({ chapter }: { chapter: Chapter }) {
  const navigate = useNavigate();

  const handleClick = () => navigate(`/chapter/${chapter.id}`);

  const completedCount = progressService.getCompletedCount(chapter.id);

  return (
    <button
      type="button"
      className="chapter-card"
      onClick={handleClick}
      aria-label={`Open ${chapter.title}`}
    >
      <div className="chapter-card-content">
        <div className="chapter-card-main">
          <h3>{chapter.title}</h3>
          <p className="chapter-desc">{chapter.description}</p>
          {completedCount > 0 && <p className="chapter-progress-badge">{completedCount} completed</p>}
        </div>

        <div className="chapter-arrow" aria-hidden>
          →
        </div>
      </div>
    </button>
  );
}
