import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChapterActivityList from '../components/ChapterActivityList';
import ChapterPerformanceCard from '../components/ChapterPerformanceCard';
import DailyActivityChart from '../components/DailyActivityChart';
import MistakeList from '../components/MistakeList';
import RecoveryMetricsSummary from '../components/RecoveryMetricsSummary';
import ResumeBanner from '../components/ResumeBanner';
import { activityService } from '../services/activityService';
import { authService } from '../services/authService';
import { buildDailyActivity } from '../services/dailyActivity';
import { mistakeService } from '../services/mistakeService';
import { performanceService } from '../services/performanceService';
import { questionService } from '../services/questionService';
import { recoveryService } from '../services/recoveryService';
import { sessionPointerService } from '../services/sessionPointerService';
import { sessionService } from '../services/sessionService';
import type { ChapterActivity } from '../types/activity';
import type { Chapter } from '../types/chapter';
import type { UnresolvedMistake } from '../types/mistake';
import type { TopicPerformance } from '../types/performance';
import type { RecoveryMetricsResponse } from '../types/recovery';
import type { SessionPointer } from '../types/sessionPointer';
import './DashboardPage.css';

// Self-Serve Learning Loop V1, Slice 1: mirrors
// learning_context_service.WEAK_ACCURACY_THRESHOLD exactly - deliberately
// duplicated (not fetched from any endpoint) the same way Progress Hub V1
// already duplicates day-bucketing logic client-side rather than adding a
// new API purely to expose one derived boolean. If the server-side
// threshold ever changes, this constant must change with it.
const WEAK_ACCURACY_THRESHOLD = 0.6;

function isWeakTopic(performance?: TopicPerformance): boolean {
  return !!performance && !performance.mastered && performance.accuracy < WEAK_ACCURACY_THRESHOLD;
}

interface ChapterWithPerformance {
  chapter: Chapter;
  performance?: TopicPerformance;
  // The chapter's Topic, when it has one — carried through so the card can
  // offer a Learn action (IA-1). The topic lookup below already happened
  // for the performance correlation; this just stops discarding its id.
  topicId?: string;
  // Self-Serve Learning Loop V1, Slice 1: same weak-topic definition the
  // Revision engine itself uses - see isWeakTopic above.
  hasWeakEvidence: boolean;
}

interface DashboardData {
  studentName: string;
  chapters: ChapterWithPerformance[];
  resume?: { pointer: SessionPointer; chapterTitle: string };
  // Progress Hub V1 (additive): dailyActivity is built client-side from the
  // raw, un-bucketed recentAttempts the backend returns - the backend
  // deliberately does no day-grouping (timezone decision), so this must
  // happen here, against the browser's own local calendar days.
  dailyActivity: ReturnType<typeof buildDailyActivity>;
  chapterActivity: ChapterActivity[];
  // Self-Serve Learning Loop V1, Slice 6a: the full response, unmodified -
  // DashboardPage renders lifetime/recent/hasRecentActivity directly via
  // RecoveryMetricsSummary; chapters is fetched but deliberately not
  // rendered yet (compact aggregate summary only for this first version).
  recovery: RecoveryMetricsResponse;
  // Self-Serve Learning Loop V1, Slice 6b: GET /performance/me/mistakes,
  // unmodified - "unresolved" is entirely backend-determined
  // (mistake_service.py); this is never recomputed or filtered further here.
  mistakes: UnresolvedMistake[];
}

// GET /performance/me is keyed by topicId, not chapterId (attempt_service
// aggregates per topic) - correlating a chapter to its performance requires
// looking up that chapter's topic first. Only chapters with a Topic can ever
// show a performance badge; chapters without one legitimately never will.
async function loadDashboard(): Promise<DashboardData> {
  const [user, chapters, performanceList, activity, recovery, mistakes] = await Promise.all([
    authService.getCurrentUser(),
    questionService.getChapters(),
    performanceService.getMyPerformance(),
    activityService.getMyActivity(),
    recoveryService.getMyRecoveryMetrics(),
    mistakeService.getMyMistakes(),
  ]);

  const topicsPerChapter = await Promise.all(
    chapters.map((chapter) => questionService.getTopics(chapter.id)),
  );

  const performanceByTopicId = new Map(performanceList.map((entry) => [entry.topicId, entry]));

  const chaptersWithPerformance = chapters.map((chapter, index) => {
    const topics = topicsPerChapter[index];
    const performance = topics.length > 0 ? performanceByTopicId.get(topics[0].id) : undefined;
    return { chapter, performance, topicId: topics[0]?.id, hasWeakEvidence: isWeakTopic(performance) };
  });

  const resume = user?.id ? await resolveResume(user.id, chapters) : undefined;

  return {
    studentName: user?.name ?? '',
    chapters: chaptersWithPerformance,
    resume,
    // Bucketed here, client-side, against the browser's own local calendar
    // days - the backend's recentAttempts is deliberately raw/un-bucketed.
    dailyActivity: buildDailyActivity(activity.recentAttempts),
    chapterActivity: activity.chapterActivity,
    recovery,
    mistakes,
  };
}

// Only ever shows a banner for a *confirmed-live* session, and only ever
// clears the pointer on a *confirmed* stale signal (not-found, or a real
// terminal status) - a transient network failure leaves the pointer alone
// rather than risking discarding a still-valid one.
async function resolveResume(
  studentId: string,
  chapters: Chapter[],
): Promise<{ pointer: SessionPointer; chapterTitle: string } | undefined> {
  const pointer = sessionPointerService.getActiveSessionFor(studentId);
  if (!pointer) {
    return undefined;
  }

  try {
    const result = await sessionService.getSessionSummary(pointer.sessionId);
    if (result.type === 'ok' && (result.summary.status === 'not_started' || result.summary.status === 'in_progress')) {
      const chapterTitle = chapters.find((chapter) => chapter.id === pointer.chapterId)?.title ?? 'your chapter';
      return { pointer, chapterTitle };
    }

    // Confirmed not-found, or confirmed terminal - genuinely stale.
    sessionPointerService.clearActiveSession();
    return undefined;
  } catch {
    return undefined;
  }
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const handleLogout = () => {
    authService.logout().finally(() => navigate('/'));
  };

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);

    loadDashboard()
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  if (loadError) {
    return (
      <main className="container">
        <h1>Dashboard</h1>
        <p>Something went wrong loading your dashboard.</p>
        <button onClick={() => setRetryToken((token) => token + 1)}>Retry</button>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container">
        <h1>Dashboard</h1>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="container dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Welcome{data.studentName ? `, ${data.studentName}` : ''}!</h1>
          <p className="tagline">Pick a chapter to keep practicing.</p>
        </div>
        <button type="button" className="link-button" onClick={handleLogout}>
          Log out
        </button>
      </div>

      {data.resume && (
        <ResumeBanner chapterTitle={data.resume.chapterTitle} sessionId={data.resume.pointer.sessionId} />
      )}

      <div className="chapter-grid">
        {data.chapters.map(({ chapter, performance, topicId, hasWeakEvidence }) => (
          <ChapterPerformanceCard
            key={chapter.id}
            chapter={chapter}
            performance={performance}
            topicId={topicId}
            hasWeakEvidence={hasWeakEvidence}
          />
        ))}
      </div>

      {/* Progress Hub V1: additive section, doesn't disturb the chapter
          grid above. Activity (questions practiced) is the primary signal
          throughout; correctness is shown only as smaller, secondary text -
          this is a practice-consistency view, not a score report. */}
      <section className="dashboard-progress-section">
        <h2>Your Progress</h2>
        <p className="tagline">The last 7 days of practice.</p>
        <DailyActivityChart days={data.dailyActivity} />

        <h3 className="dashboard-progress-subheading">By Chapter</h3>
        <ChapterActivityList chapters={data.chapterActivity} />

        {/* Self-Serve Learning Loop V1, Slice 6a: additive, compact aggregate
            summary of GET /performance/me/recovery - lifetime/recent only,
            no per-chapter breakdown (deferred to a later slice, see
            RecoveryMetricsSummary's own docstring). Every value rendered is
            backend-provided; nothing here recomputes accuracy, recovery
            rate, or sample sufficiency. */}
        <h3 className="dashboard-progress-subheading">Recovering from Mistakes</h3>
        <RecoveryMetricsSummary
          lifetime={data.recovery.lifetime.recovery}
          recent={data.recovery.recent.recovery}
          hasRecentActivity={data.recovery.hasRecentActivity}
        />

        {/* Self-Serve Learning Loop V1, Slice 6b: additive list of
            GET /performance/me/mistakes - there is no infrastructure to
            practice one exact missed question, so MistakeList's own action
            is honestly chapter-level ("Practice this chapter" ->
            /practice/:chapterId), never a promise that the exact question
            will be served again. See MistakeList's own docstring. */}
        <h3 className="dashboard-progress-subheading">Needs Practice</h3>
        <MistakeList mistakes={data.mistakes} />
      </section>
    </main>
  );
}
