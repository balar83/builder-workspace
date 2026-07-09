import './DifficultyBadge.css';
import type { Difficulty } from '../types/question';

export default function DifficultyBadge({ level }: { level: Difficulty }) {
  const color = level === 'Easy' ? '#10b981' : level === 'Medium' ? '#f59e0b' : '#ef4444';

  return (
    <span className="difficulty-badge" style={{ background: color }}>
      {level}
    </span>
  );
}
