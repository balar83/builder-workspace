import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('../../src/services/questionService', () => ({
  questionService: {
    getChapters: vi.fn(),
    getTopics: vi.fn(),
  },
}));

vi.mock('../../src/services/performanceService', () => ({
  performanceService: {
    getMyPerformance: vi.fn(),
    getMyConceptPerformance: vi.fn(),
  },
}));

vi.mock('../../src/services/activityService', () => ({
  activityService: {
    getMyActivity: vi.fn(),
  },
}));

vi.mock('../../src/services/sessionPointerService', () => ({
  sessionPointerService: {
    getActiveSessionFor: vi.fn(),
    clearActiveSession: vi.fn(),
  },
}));

vi.mock('../../src/services/sessionService', () => ({
  sessionService: {
    getSessionSummary: vi.fn(),
  },
}));

import DashboardPage from '../../src/pages/DashboardPage';
import { activityService } from '../../src/services/activityService';
import { authService } from '../../src/services/authService';
import { performanceService } from '../../src/services/performanceService';
import { questionService } from '../../src/services/questionService';
import { sessionPointerService } from '../../src/services/sessionPointerService';

const chapter = { id: 'rational-numbers', title: 'Rational Numbers', description: 'D' };

function setUpDefaultMocks() {
  vi.mocked(authService.getCurrentUser).mockResolvedValue({ role: 'student', id: 'learner_1', name: null });
  vi.mocked(questionService.getChapters).mockResolvedValue([chapter]);
  vi.mocked(questionService.getTopics).mockResolvedValue([]);
  vi.mocked(performanceService.getMyPerformance).mockResolvedValue([]);
  vi.mocked(performanceService.getMyConceptPerformance).mockResolvedValue([]);
  vi.mocked(sessionPointerService.getActiveSessionFor).mockReturnValue(undefined);
  vi.mocked(activityService.getMyActivity).mockResolvedValue({ recentAttempts: [], chapterActivity: [] });
}

describe('DashboardPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('still renders the existing chapter grid (regression: unchanged by the Progress Hub addition)', async () => {
    setUpDefaultMocks();

    render(<DashboardPage />);

    expect(await screen.findByRole('heading', { name: 'Rational Numbers', level: 2 })).toBeInTheDocument();
  });

  it('renders the additive "Your Progress" section with a chart and chapter list', async () => {
    setUpDefaultMocks();

    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Rational Numbers', level: 2 });

    expect(screen.getByRole('heading', { name: 'Your Progress' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Questions practiced over the last 7 days/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'By Chapter' })).toBeInTheDocument();
  });

  it('builds the daily timeline from raw recentAttempts client-side and shows the resulting count', async () => {
    setUpDefaultMocks();
    const today = new Date().toISOString();
    vi.mocked(activityService.getMyActivity).mockResolvedValue({
      recentAttempts: [
        { questionId: 'rn-q01', chapterId: 'rational-numbers', isCorrect: true, createdAt: today },
        { questionId: 'rn-q02', chapterId: 'rational-numbers', isCorrect: false, createdAt: today },
      ],
      chapterActivity: [],
    });

    render(<DashboardPage />);

    await screen.findByText('Today');
    // 2 distinct questions attempted today, primary metric.
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  it('shows lifetime chapter-wise activity, including a chapter with no Topic', async () => {
    setUpDefaultMocks();
    vi.mocked(activityService.getMyActivity).mockResolvedValue({
      recentAttempts: [],
      chapterActivity: [
        {
          chapterId: 'practical-geometry',
          chapterTitle: 'Practical Geometry',
          questionsAttempted: 3,
          questionsCorrect: 2,
          accuracy: 0.6667,
          lastActivityAt: new Date().toISOString(),
        },
      ],
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Practical Geometry')).toBeInTheDocument();
    expect(screen.getByText(/3 practiced · 2 solved/)).toBeInTheDocument();
  });

  it('shows an empty chapter-activity message when nothing has been practiced yet', async () => {
    setUpDefaultMocks();

    render(<DashboardPage />);

    expect(await screen.findByText('No chapters practiced yet.')).toBeInTheDocument();
  });

  // Self-Serve Learning Loop V1, Slice 1: the weak-topic CTA must appear
  // only for genuine weak-topic evidence (accuracy below threshold, not
  // mastered) - not merely "attempted" or "not perfect."
  describe('weak-area Revision CTA wiring', () => {
    it('shows the CTA for a chapter whose topic accuracy is below the weak-topic threshold', async () => {
      setUpDefaultMocks();
      vi.mocked(questionService.getTopics).mockResolvedValue([
        { id: 'topic-rn', chapterId: 'rational-numbers', title: 'RN', concepts: [] } as never,
      ]);
      vi.mocked(performanceService.getMyPerformance).mockResolvedValue([
        {
          topicId: 'topic-rn',
          questionsAttempted: 4,
          questionsCorrect: 1,
          accuracy: 0.25,
          currentStreak: 0,
          mastered: false,
        },
      ]);

      render(<DashboardPage />);

      expect(await screen.findByRole('button', { name: 'Practise your weak areas' })).toBeInTheDocument();
    });

    it('does not show the CTA for a chapter with high accuracy', async () => {
      setUpDefaultMocks();
      vi.mocked(questionService.getTopics).mockResolvedValue([
        { id: 'topic-rn', chapterId: 'rational-numbers', title: 'RN', concepts: [] } as never,
      ]);
      vi.mocked(performanceService.getMyPerformance).mockResolvedValue([
        {
          topicId: 'topic-rn',
          questionsAttempted: 4,
          questionsCorrect: 4,
          accuracy: 1,
          currentStreak: 4,
          mastered: true,
        },
      ]);

      render(<DashboardPage />);

      await screen.findByRole('heading', { name: 'Rational Numbers', level: 2 });
      expect(screen.queryByRole('button', { name: 'Practise your weak areas' })).toBeNull();
    });

    it('does not show the CTA for a chapter with no recorded performance yet', async () => {
      setUpDefaultMocks();

      render(<DashboardPage />);

      await screen.findByRole('heading', { name: 'Rational Numbers', level: 2 });
      expect(screen.queryByRole('button', { name: 'Practise your weak areas' })).toBeNull();
    });
  });
});
