import { useEffect, useState } from 'react';
import ChapterPerformanceCard from '../components/ChapterPerformanceCard';
import { authService } from '../services/authService';
import { performanceService } from '../services/performanceService';
import { questionService } from '../services/questionService';
import type { Chapter } from '../types/chapter';
import type { TopicPerformance } from '../types/performance';
import './DashboardPage.css';

interface ChapterWithPerformance {
  chapter: Chapter;
  performance?: TopicPerformance;
}

interface DashboardData {
  studentName: string;
  chapters: ChapterWithPerformance[];
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

  return {
    studentName: user?.name ?? '',
    chapters: chapters.map((chapter, index) => {
      const topics = topicsPerChapter[index];
      const performance = topics.length > 0 ? performanceByTopicId.get(topics[0].id) : undefined;
      return { chapter, performance };
    }),
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

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
      <h1>Welcome{data.studentName ? `, ${data.studentName}` : ''}!</h1>
      <p className="tagline">Pick a chapter to keep practicing.</p>

      <div className="chapter-grid">
        {data.chapters.map(({ chapter, performance }) => (
          <ChapterPerformanceCard key={chapter.id} chapter={chapter} performance={performance} />
        ))}
      </div>
    </main>
  );
}
