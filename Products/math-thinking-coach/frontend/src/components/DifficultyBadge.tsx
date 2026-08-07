import './DifficultyBadge.css';
import type { Difficulty } from '../types/question';

// Muted chip rather than a saturated pill: difficulty is metadata, and a
// solid green/amber/red badge previously competed with the primary action
// for attention inside the question card (UX review Q8). The level is
// still distinguishable by a colour dot *and* by its text, so colour is
// never the only channel.
export default function DifficultyBadge({ level }: { level: Difficulty }) {
  return (
    <span className={`difficulty-badge difficulty-badge-${level.toLowerCase()}`}>
      <span className="difficulty-badge-dot" aria-hidden="true" />
      {level}
    </span>
  );
}
