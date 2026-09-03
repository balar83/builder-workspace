import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChapterActivityList from '../components/ChapterActivityList';
import ChapterPerformanceCard from '../components/ChapterPerformanceCard';
import DailyActivityChart from '../components/DailyActivityChart';
import ResumeBanner from '../components/ResumeBanner';
import { activityService } from '../services/activityService';
import { authService } from '../services/authService';
import { buildDailyActivity } from '../services/dailyActivity';
import { performanceService } from '../services/performanceService';
import { questionService } from '../services/questionService';
import { sessionPointerService } from '../services/sessionPointerService';
import { sessionService } from '../services/sessionService';
import type { ChapterActivity } from '../types/activity';
import type { Chapter } from '../types/chapter';
import type { TopicPerformance } from '../types/performance';
import type { SessionPointer } from '../types/sessionPointer';
import './DashboardPage.css';

interface ChapterWithPerformance {
  chapter: Chapter;
  performance?: TopicPerformance;
  // The chapter's Topic, when it has one — carried through so the card can
  // offer a Learn action (IA-1). The topic lookup below already happened
  // for the performance correlation; this just stops discarding its id.
  topicId?: string;
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
}

// GET /performance/me is keyed by topicId, not chapterId (attempt_service
// aggregates per topic) - correlating a chapter to its performance requires
// looking up that chapter's topic first. Only chapters with a Topic can ever
// show a performance badge; chapters without one legitimately never will.
async function loadDashboard(): Promise<DashboardData> {
  const [user, chapters, performanceList, activity] = await Promise.all([
    authService.getCurrentUser(),
    questionService.getChapters(),
    performanceService.getMyPerformance(),
    activityService.getMyActivity(),
  ]);

  const topicsPerChapter = await Promise.all(
    chapters.map((chapter) => questionService.getTopics(chapter.id)),
  );

  const performanceByTopicId = new Map(performanceList.map((entry) => [entry.topicId, entry]));

  const chaptersWithPerformance = chapters.map((chapter, index) => {
    const topics = topicsPerChapter[index];
    const performance = topics.length > 0 ? performanceByTopicId.get(topics[0].id) : undefined;
    return { chapter, performance, topicId: topics[0]?.id };
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
        {data.chapters.map(({ chapter, performance, topicId }) => (
          <ChapterPerformanceCard
            key={chapter.id}
            chapter={chapter}
            performance={performance}
            topicId={topicId}
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
      </section>
    </main>
  );
}
