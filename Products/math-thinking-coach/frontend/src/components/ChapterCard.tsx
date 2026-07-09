import { useNavigate } from 'react-router-dom';
import type { Chapter } from '../types/chapter';
import './ChapterCard.css';

export default function ChapterCard({ chapter }: { chapter: Chapter }) {
  const navigate = useNavigate();

  const handleClick = () => navigate(`/question/${chapter.id}`);

  return (
    <button
      type="button"
      className="chapter-card"
      onClick={handleClick}
      aria-label={`Open questions for ${chapter.title}`}
    >
      <div className="chapter-card-content">
        <div className="chapter-card-main">
          <h3>{chapter.title}</h3>
          <p className="chapter-desc">{chapter.description}</p>
        </div>

        <div className="chapter-arrow" aria-hidden>
          →
        </div>
      </div>
    </button>
  );
}
