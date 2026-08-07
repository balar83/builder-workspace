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
          {/* A <span>, not an <h3>: the whole card is a <button>, whose
              content model is phrasing content only, so a heading here was
              invalid HTML that no assistive technology exposed as a heading
              anyway (the button's accessible name flattens it). Dropping it
              also removes the h1 -> h3 level skip this page had. */}
          <span className="chapter-card-title">{chapter.title}</span>
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
