import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ sessionId: 'session-1' }),
  useLocation: () => ({ state: null }),
}));

vi.mock('../../src/services/sessionService', () => ({
  sessionService: {
    getCurrentQuestion: vi.fn(),
    getSessionSummary: vi.fn(),
    submitSessionAnswer: vi.fn(),
    createSession: vi.fn(),
  },
}));

import SessionQuestionPage from '../../src/pages/SessionQuestionPage';
import { sessionService } from '../../src/services/sessionService';

const questionContent = {
  id: 'le-q01',
  question: 'Solve for x: 2x = 36',
  text: 'Solve for x: 2x = 36',
  difficulty: 'Easy' as const,
  hints: ['Divide both sides by 2', 'x is a whole number'],
  solution: 'x = 18',
  questionType: 'short_text' as const,
  responseSpecification: null,
};

const summary = {
  sessionId: 'session-1',
  mode: 'practice' as const,
  status: 'in_progress' as const,
  position: 0,
  totalCount: 1,
  correctCount: 0,
  startedAt: null,
  completedAt: null,
  timeLimitMinutes: null,
};

function mockLiveQuestion() {
  vi.mocked(sessionService.getCurrentQuestion).mockResolvedValue({
    type: 'question',
    question: { position: 0, totalCount: 1, question: questionContent },
  });
  vi.mocked(sessionService.getSessionSummary).mockResolvedValue({ type: 'ok', summary });
}

describe('SessionQuestionPage - hint/mastery correctness fix', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Correctness Integrity slice: mirrors QuestionPage.tsx's fix - the
  // session flow's own currentHintIndex state must reach the server too
  // (Phase-1-Handoff.md §12.2's standing "check the other flow" risk).
  it('submits hintsUsed matching the number of hints revealed', async () => {
    mockLiveQuestion();
    vi.mocked(sessionService.submitSessionAnswer).mockResolvedValue({
      type: 'ok',
      response: {
        evaluation: { isCorrect: true, score: 1 },
        coach: { message: 'Excellent!', nextAction: 'NEXT_QUESTION' },
        ui: { canTryAgain: false, canRevealSolution: false, hintLevel: 0 },
        position: 0,
        totalCount: 1,
        sessionStatus: 'completed',
      },
    });

    render(<SessionQuestionPage />);

    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.click(screen.getByRole('button', { name: 'Need a Hint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Next Hint' }));

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    await waitFor(() =>
      expect(sessionService.submitSessionAnswer).toHaveBeenCalledWith('session-1', {
        position: 0,
        answer: '18',
        hintsUsed: 2,
      }),
    );
  });

  it('submits hintsUsed: 0 when no hint was revealed', async () => {
    mockLiveQuestion();
    vi.mocked(sessionService.submitSessionAnswer).mockResolvedValue({
      type: 'ok',
      response: {
        evaluation: { isCorrect: true, score: 1 },
        coach: { message: 'Excellent!', nextAction: 'NEXT_QUESTION' },
        ui: { canTryAgain: false, canRevealSolution: false, hintLevel: 0 },
        position: 0,
        totalCount: 1,
        sessionStatus: 'completed',
      },
    });

    render(<SessionQuestionPage />);

    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    await waitFor(() =>
      expect(sessionService.submitSessionAnswer).toHaveBeenCalledWith('session-1', {
        position: 0,
        answer: '18',
        hintsUsed: 0,
      }),
    );
  });
});

describe('SessionQuestionPage - terminal screen next steps (S1)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const forbidden = /mistake|revise|readiness|\btest\b/i;

  function mockTerminal(status: 'completed' | 'expired' | 'abandoned', mode: 'practice' | 'revision' | 'test') {
    vi.mocked(sessionService.getCurrentQuestion).mockResolvedValue({
      type: 'terminal',
      terminal: { sessionId: 'session-1', status, position: 1, totalCount: 1, correctCount: 1 },
    });
    vi.mocked(sessionService.getSessionSummary).mockResolvedValue({
      type: 'ok',
      summary: { ...summary, mode, status },
    });
  }

  const cases: Array<['completed' | 'expired' | 'abandoned', 'practice' | 'revision' | 'test']> = [
    ['completed', 'practice'],
    ['completed', 'revision'],
    ['completed', 'test'],
    ['expired', 'test'],
    ['abandoned', 'practice'],
  ];

  it.each(cases)('offers both next steps for %s / %s', async (status, mode) => {
    mockTerminal(status, mode);
    render(<SessionQuestionPage />);

    const primary = await screen.findByRole('button', { name: 'View your progress' });
    const secondary = screen.getByRole('button', { name: 'Choose another chapter' });

    expect(secondary).toHaveClass('btn-secondary');
    expect(screen.queryByRole('button', { name: 'Back to Dashboard' })).not.toBeInTheDocument();
    expect(primary.textContent).not.toMatch(forbidden);
    expect(secondary.textContent).not.toMatch(forbidden);
    expect(document.body.textContent).not.toMatch(/mistake|readiness/i);

    fireEvent.click(primary);
    expect(mockNavigate).toHaveBeenLastCalledWith('/dashboard');
    fireEvent.click(secondary);
    expect(mockNavigate).toHaveBeenLastCalledWith('/chapters');
  });

  it('offers both next steps when the summary fails to load', async () => {
    vi.mocked(sessionService.getCurrentQuestion).mockResolvedValue({
      type: 'terminal',
      terminal: { sessionId: 'session-1', status: 'completed', position: 1, totalCount: 1, correctCount: 1 },
    });
    vi.mocked(sessionService.getSessionSummary).mockRejectedValue(new Error('boom'));

    render(<SessionQuestionPage />);

    await screen.findByText("You've completed this session.");
    fireEvent.click(screen.getByRole('button', { name: 'View your progress' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Choose another chapter' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/chapters');
    expect(document.body.textContent).not.toMatch(/mistake|readiness/i);
  });

  it('leaves the load-error and not-found screens unchanged', async () => {
    vi.mocked(sessionService.getCurrentQuestion).mockResolvedValueOnce({ type: 'not-found' });
    const { unmount } = render(<SessionQuestionPage />);
    await screen.findByText("This session isn't available.");
    expect(screen.getByRole('button', { name: 'Back to Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose another chapter' })).not.toBeInTheDocument();
    unmount();

    vi.mocked(sessionService.getCurrentQuestion).mockRejectedValueOnce(new Error('boom'));
    render(<SessionQuestionPage />);
    await screen.findByText('Something went wrong loading this session.');
    expect(screen.getByRole('button', { name: 'Back to Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose another chapter' })).not.toBeInTheDocument();
  });
});
