import type { ChapterActivity } from '../types/activity';
import './ChapterActivityList.css';

export interface ChapterActivityListProps {
  chapters: ChapterActivity[];
}

function formatLastActivity(iso: string | null): string {
  if (!iso) {
    return 'Not yet practiced';
  }
  // Browser-local formatting, same principle as the daily timeline - the
  // server timestamp is never shown to a learner/parent as raw UTC.
  return `Last practiced ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

// Lifetime, chapter-wise activity - every curriculum chapter is listed,
// including one with zero recorded attempts and one with no Topic (e.g.
// Practical Geometry), so curriculum coverage is visible at a glance -
// unlike the Dashboard's existing per-topic ChapterPerformanceCard badge,
// which only ever shows a chapter that already has a Topic and performance.
export default function ChapterActivityList({ chapters }: ChapterActivityListProps) {
  if (chapters.length === 0) {
    return <p className="chapter-activity-empty">No chapters practiced yet.</p>;
  }

  return (
    <ul className="chapter-activity-list">
      {chapters.map((chapter) => (
        <li key={chapter.chapterId} className="chapter-activity-item">
          <span className="chapter-activity-title">{chapter.chapterTitle}</span>
          <span className="chapter-activity-stats">
            {chapter.questionsAttempted} practiced · {chapter.questionsCorrect} solved
            {chapter.questionsAttempted > 0 && ` · ${Math.round(chapter.accuracy * 100)}%`}
          </span>
          <span className="chapter-activity-last">{formatLastActivity(chapter.lastActivityAt)}</span>
        </li>
      ))}
    </ul>
  );
}
