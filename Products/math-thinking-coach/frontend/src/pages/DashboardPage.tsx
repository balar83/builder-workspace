import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChapterPerformanceCard from '../components/ChapterPerformanceCard';
import ResumeBanner from '../components/ResumeBanner';
import { authService } from '../services/authService';
import { performanceService } from '../services/performanceService';
import { questionService } from '../services/questionService';
import { sessionPointerService } from '../services/sessionPointerService';
import { sessionService } from '../services/sessionService';
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
}

// GET /performance/me is keyed by topicId, not chapterId (attempt_service
// aggregates per topic) - correlating a chapter to its performance requires
// looking up that chapter's topic first. Only chapters with a Topic can ever
// show a performance badge; chapters without one legitimately never will.
async function loadDashboard(): Promise<DashboardData> {
  const [user, chapters, performanceList] = await Promise.all([
    authService.getCurrentUser(),
    questionService.getChapters(),
    performanceService.getMyPerformance(),
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
    </main>
  );
}
