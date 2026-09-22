import { useNavigate } from 'react-router-dom';
import '../components/ChapterCard.css';
import './ChapterPerformanceCard.css';
import type { ChapterActivity } from '../types/activity';
import type { Chapter } from '../types/chapter';
import type { ConceptPerformance, TopicPerformance } from '../types/performance';
import type { Concept } from '../types/topic';

export interface ChapterPerformanceCardProps {
  chapter: Chapter;
  performance?: TopicPerformance;
  // Present only for chapters that actually have an exported Topic. The
  // Learn action is what puts the lesson inside the authenticated journey
  // (UX review IA-1) — before this, /topic/:topicId was reachable only
  // from the anonymous chapter page, so a logged-in student could never
  // see the teaching content at all.
  topicId?: string;
  // D1: this chapter's topic's Concepts, for the breakdown's titles/order -
  // present exactly when topicId is (a Topic without concepts, i.e. an
  // unmigrated chapter, cannot occur post-A2b, but an empty array is
  // handled the same as absent).
  concepts?: Concept[];
  // D1: this student's per-concept aggregates, already scoped to this
  // chapter's concepts by the caller. A concept with no entry here has zero
  // attempts and renders as "Not yet attempted" - never a 0% accuracy,
  // per D1's product-meaning rule ("recent accuracy on questions covering
  // this idea", not mastery/understanding/readiness).
  conceptPerformance?: ConceptPerformance[];
  // Self-Serve Learning Loop V1, Slice 1: true only when this chapter's
  // topic meets the same weak-topic definition the Revision engine itself
  // uses (learning_context_service.WEAK_ACCURACY_THRESHOLD) - the caller
  // (DashboardPage) computes this from data it already fetches. Undefined/
  // false renders no CTA at all - never a placeholder for "not weak yet."
  hasWeakEvidence?: boolean;
  // S5 (Derived Chapter Progress): this chapter's GET /performance/me/activity entry,
  // matched by chapterId. Its counts are DISTINCT questions, unlike
  // performance's row counts, so performance contributes only its existing
  // mastered flag here. Absent renders no status line at all - never an
  // unverified "Not started".
  activity?: ChapterActivity;
}

// S5: attempted === 0 wins even over an (inconsistent) mastered flag, so
// "Mastered" can never appear with zero counts. A chapter with no Topic
// (Practical Geometry) has no performance, so it can never read Mastered.
function chapterProgressLabel(activity: ChapterActivity, performance?: TopicPerformance): string {
  const { questionsAttempted, questionsCorrect } = activity;
  if (questionsAttempted === 0) {
    return 'Not started';
  }
  const state = performance?.mastered === true ? 'Mastered' : 'In progress';
  return `${state} · ${questionsAttempted} tried · ${questionsCorrect} solved`;
}

export default function ChapterPerformanceCard({
  chapter,
  performance,
  topicId,
  concepts,
  conceptPerformance,
  hasWeakEvidence,
  activity,
}: ChapterPerformanceCardProps) {
  const navigate = useNavigate();

  const reviewConcept = (conceptId: string) =>
    navigate(`/topic/${topicId}?from=dashboard#concept-heading-${conceptId}`);

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
          {activity && <p className="chapter-progress-badge">{chapterProgressLabel(activity, performance)}</p>}

          {topicId && concepts && concepts.length > 0 && (
            <ul className="concept-performance-list">
              {concepts.map((concept) => {
                const stats = conceptPerformance?.find((row) => row.conceptId === concept.id);

                return (
                  <li key={concept.id} className="concept-performance-item">
                    <span className="concept-performance-title">{concept.title}</span>
                    <span className="concept-performance-stats">
                      {stats ? `${stats.questionsCorrect}/${stats.questionsAttempted}` : 'Not yet attempted'}
                    </span>
                    <button
                      type="button"
                      className="link-button concept-review-link"
                      onClick={() => reviewConcept(concept.id)}
                    >
                      Review
                    </button>
                  </li>
                );
              })}
            </ul>
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
