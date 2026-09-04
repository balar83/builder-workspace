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

vi.mock('../../src/services/recoveryService', () => ({
  recoveryService: {
    getMyRecoveryMetrics: vi.fn(),
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
import { recoveryService } from '../../src/services/recoveryService';
import { sessionPointerService } from '../../src/services/sessionPointerService';
import type { RecoveryMetric, RecoveryMetricsResponse } from '../../src/types/recovery';

const chapter = { id: 'rational-numbers', title: 'Rational Numbers', description: 'D' };

const NO_EVIDENCE_METRIC: RecoveryMetric = { recovered: 0, initiallyWrong: 0, rate: null, sufficientSample: false };
const NO_EVIDENCE_ACCURACY = { correct: 0, attempted: 0, accuracy: null };
const NO_EVIDENCE_WINDOW = {
  firstAttemptAccuracy: NO_EVIDENCE_ACCURACY,
  eventualAccuracy: NO_EVIDENCE_ACCURACY,
  recovery: NO_EVIDENCE_METRIC,
};
const NO_EVIDENCE_RECOVERY: RecoveryMetricsResponse = {
  lifetime: NO_EVIDENCE_WINDOW,
  recent: NO_EVIDENCE_WINDOW,
  hasRecentActivity: false,
  chapters: [],
};

function setUpDefaultMocks() {
  vi.mocked(authService.getCurrentUser).mockResolvedValue({ role: 'student', id: 'learner_1', name: null });
  vi.mocked(questionService.getChapters).mockResolvedValue([chapter]);
  vi.mocked(questionService.getTopics).mockResolvedValue([]);
  vi.mocked(performanceService.getMyPerformance).mockResolvedValue([]);
  vi.mocked(performanceService.getMyConceptPerformance).mockResolvedValue([]);
  vi.mocked(sessionPointerService.getActiveSessionFor).mockReturnValue(undefined);
  vi.mocked(activityService.getMyActivity).mockResolvedValue({ recentAttempts: [], chapterActivity: [] });
  vi.mocked(recoveryService.getMyRecoveryMetrics).mockResolvedValue(NO_EVIDENCE_RECOVERY);
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

  // Self-Serve Learning Loop V1, Slice 6a: GET /performance/me/recovery
  // integrated into the existing "Your Progress" section - compact
  // aggregate only, no per-chapter breakdown. Every value asserted here is
  // the exact backend-shaped input, proving the page renders it directly
  // rather than recomputing anything.
  describe('recovery metrics wiring', () => {
    it('renders the additive "Recovering from Mistakes" subsection', async () => {
      setUpDefaultMocks();

      render(<DashboardPage />);

      await screen.findByRole('heading', { name: 'Rational Numbers', level: 2 });
      expect(screen.getByRole('heading', { name: 'Recovering from Mistakes' })).toBeInTheDocument();
    });

    it('shows an explicit no-evidence state for a learner with no wrong first attempts yet, never a 0%', async () => {
      setUpDefaultMocks();

      render(<DashboardPage />);

      expect(await screen.findAllByText('No wrong first attempts yet.')).toHaveLength(1);
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    });

    it('shows counts and an explicit insufficient-evidence message without fabricating a rate', async () => {
      setUpDefaultMocks();
      const insufficient: RecoveryMetric = { recovered: 1, initiallyWrong: 2, rate: null, sufficientSample: false };
      vi.mocked(recoveryService.getMyRecoveryMetrics).mockResolvedValue({
        lifetime: { ...NO_EVIDENCE_WINDOW, recovery: insufficient },
        recent: NO_EVIDENCE_WINDOW,
        hasRecentActivity: false,
        chapters: [],
      });

      render(<DashboardPage />);

      expect(
        await screen.findByText('1 of 2 recovered so far — not enough evidence yet for a reliable rate.'),
      ).toBeInTheDocument();
    });

    it('shows the real recovery rate and underlying counts once the sample is sufficient', async () => {
      setUpDefaultMocks();
      const sufficient: RecoveryMetric = { recovered: 3, initiallyWrong: 4, rate: 0.75, sufficientSample: true };
      vi.mocked(recoveryService.getMyRecoveryMetrics).mockResolvedValue({
        lifetime: { ...NO_EVIDENCE_WINDOW, recovery: sufficient },
        recent: NO_EVIDENCE_WINDOW,
        hasRecentActivity: false,
        chapters: [],
      });

      render(<DashboardPage />);

      expect(await screen.findByText('75%')).toBeInTheDocument();
      expect(screen.getByText('(3 of 4)')).toBeInTheDocument();
    });

    it('distinguishes lifetime from recent as two independently rendered windows', async () => {
      setUpDefaultMocks();
      const lifetimeSufficient: RecoveryMetric = { recovered: 3, initiallyWrong: 4, rate: 0.75, sufficientSample: true };
      const recentInsufficient: RecoveryMetric = { recovered: 1, initiallyWrong: 1, rate: null, sufficientSample: false };
      vi.mocked(recoveryService.getMyRecoveryMetrics).mockResolvedValue({
        lifetime: { ...NO_EVIDENCE_WINDOW, recovery: lifetimeSufficient },
        recent: { ...NO_EVIDENCE_WINDOW, recovery: recentInsufficient },
        hasRecentActivity: true,
        chapters: [],
      });

      render(<DashboardPage />);

      expect(await screen.findByText('75%')).toBeInTheDocument();
      expect(
        screen.getByText('1 of 1 recovered so far — not enough evidence yet for a reliable rate.'),
      ).toBeInTheDocument();
    });

    it('shows an explicit no-recent-activity message when hasRecentActivity is false, never an apparently current recent metric', async () => {
      setUpDefaultMocks();
      const lifetimeSufficient: RecoveryMetric = { recovered: 3, initiallyWrong: 4, rate: 0.75, sufficientSample: true };
      vi.mocked(recoveryService.getMyRecoveryMetrics).mockResolvedValue({
        lifetime: { ...NO_EVIDENCE_WINDOW, recovery: lifetimeSufficient },
        // Non-zero recent counts, deliberately - hasRecentActivity: false
        // must still win, proving the page trusts that explicit signal over
        // inferring "recent" from the metric's own field values.
        recent: { ...NO_EVIDENCE_WINDOW, recovery: lifetimeSufficient },
        hasRecentActivity: false,
        chapters: [],
      });

      render(<DashboardPage />);

      expect(await screen.findByText('No practice in the last 7 days.')).toBeInTheDocument();
      // Only the lifetime block's rate renders.
      expect(screen.getAllByText('75%')).toHaveLength(1);
    });
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
