import { useNavigate } from 'react-router-dom';
import type { UnresolvedMistake } from '../types/mistake';
import './MistakeList.css';

export interface MistakeListProps {
  mistakes: UnresolvedMistake[];
}

function formatLastAttempt(iso: string): string {
  // Same browser-local formatting convention as ChapterActivityList's
  // formatLastActivity - a server timestamp is never shown raw/UTC.
  return `Last attempted ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

// Self-Serve Learning Loop V1, Slice 6b. One row per unresolved question,
// mirroring GET /performance/me/mistakes exactly - "unresolved" is entirely
// a backend determination (mistake_service.py), never recomputed here.
//
// There is no infrastructure to practice one exact missed question, so the
// only action offered is chapter-level: "Practice this chapter" navigates
// to the existing /practice/:chapterId session-configuration flow (the same
// route ChapterPerformanceCard's own practice CTAs already use) - never a
// promise that this exact question will be served again.
//
// topicId is deliberately not rendered - it's an internal id/slug with no
// title resolution available to this component, not meant for direct
// display.
export default function MistakeList({ mistakes }: MistakeListProps) {
  const navigate = useNavigate();

  if (mistakes.length === 0) {
    return <p className="mistake-list-empty">No unresolved mistakes.</p>;
  }

  return (
    <ul className="mistake-list">
      {mistakes.map((mistake) => (
        <li key={mistake.questionId} className="mistake-list-item">
          <span className="mistake-list-title">{mistake.chapterTitle}</span>
          <span className="mistake-list-last">{formatLastAttempt(mistake.lastAttemptAt)}</span>
          <button
            type="button"
            className="link-button mistake-list-practice-link"
            onClick={() => navigate(`/practice/${mistake.chapterId}`)}
          >
            Practice this chapter
          </button>
        </li>
      ))}
    </ul>
  );
}
