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
    revealSolution: vi.fn(),
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

describe('SessionQuestionPage - reveal solution advancement (M1)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const secondQuestionContent = {
    id: 'le-q02',
    question: 'Solve for x: 3x = 12',
    text: 'Solve for x: 3x = 12',
    difficulty: 'Easy' as const,
    hints: [],
    solution: 'x = 4',
    questionType: 'short_text' as const,
    responseSpecification: null,
  };

  function mockRevealSolutionSuccess() {
    vi.mocked(sessionService.revealSolution).mockResolvedValue({
      type: 'ok',
      response: {
        evaluation: { isCorrect: false, score: 0, evaluatorId: 'revealed_solution_v1' },
        coach: { message: "If you're still stuck, you can view the solution.", nextAction: 'SHOW_SOLUTION' },
        ui: { canTryAgain: false, canRevealSolution: true, hintLevel: 2 },
        remediation: null,
        position: 1,
        totalCount: 2,
        sessionStatus: 'in_progress',
      },
    });
  }

  it('reveals the solution via the server, then Next Question shows the actual next question with reset state', async () => {
    mockLiveQuestion();
    vi.mocked(sessionService.getSessionSummary).mockResolvedValue({
      type: 'ok',
      summary: { ...summary, totalCount: 2 },
    });
    mockRevealSolutionSuccess();

    render(<SessionQuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');

    // Exhaust both hints - this question has exactly 2.
    fireEvent.click(screen.getByRole('button', { name: 'Need a Hint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Next Hint' }));
    expect(screen.getByRole('button', { name: 'Reveal Solution' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reveal Solution' }));

    // The server, not local state alone, is what's asked to reveal.
    await waitFor(() =>
      expect(sessionService.revealSolution).toHaveBeenCalledWith('session-1', {
        position: 0,
        hintsUsed: 2,
      }),
    );

    // Solution now shown, and the revealed outcome is visibly not "correct".
    await screen.findByText('x = 18');
    expect(screen.getByText("If you're still stuck, you can view the solution.")).toBeInTheDocument();
    const nextButton = await screen.findByRole('button', { name: 'Next Question' });

    // The next fetch must return a genuinely different question, not the
    // same one again (the exact production dead end this fixes).
    vi.mocked(sessionService.getCurrentQuestion).mockResolvedValue({
      type: 'question',
      question: { position: 1, totalCount: 2, question: secondQuestionContent },
    });

    fireEvent.click(nextButton);

    await screen.findByText('Solve for x: 3x = 12');
    expect(screen.queryByText('Solve for x: 2x = 36')).not.toBeInTheDocument();

    // Prior evaluation/feedback/solution must not leak onto question 2.
    expect(screen.queryByText('x = 18')).not.toBeInTheDocument();
    expect(screen.queryByText("If you're still stuck, you can view the solution.")).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next Question' })).not.toBeInTheDocument();

    // Hint state reset: question 2 has no hints, so the button reads "Need a Hint" again.
    expect(screen.getByRole('button', { name: 'Need a Hint' })).toBeInTheDocument();

    // Answer input reset: nothing carried over from question 1.
    expect(screen.getByPlaceholderText('Type your answer')).toHaveValue('');
  });

  it('does not advance twice on a duplicate/stale reveal response', async () => {
    mockLiveQuestion();
    vi.mocked(sessionService.revealSolution).mockResolvedValueOnce({ type: 'stale' });

    render(<SessionQuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.click(screen.getByRole('button', { name: 'Need a Hint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Next Hint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reveal Solution' }));

    await waitFor(() => expect(sessionService.revealSolution).toHaveBeenCalledTimes(1));
    // Stale means the client re-syncs via getCurrentQuestion rather than
    // fabricating a local advance - called once for the initial load, once
    // more to re-sync (never a locally-assumed "next question" beyond that).
    await waitFor(() => expect(sessionService.getCurrentQuestion).toHaveBeenCalledTimes(2));
  });

  // Regression: the coaching ladder can reach server-side SHOW_SOLUTION on
  // its own (3 genuine wrong submissions, no hints, Reveal Solution never
  // clicked) - the server has already advanced currentPosition by then.
  // Reveal Solution must still let the learner acknowledge that state
  // locally, without issuing a second (redundant) POST.
  it('acknowledges a ladder-reached SHOW_SOLUTION locally, with no extra reveal POST', async () => {
    mockLiveQuestion();
    vi.mocked(sessionService.getSessionSummary).mockResolvedValue({
      type: 'ok',
      summary: { ...summary, totalCount: 2 },
    });
    vi.mocked(sessionService.submitSessionAnswer)
      .mockResolvedValueOnce({
        type: 'ok',
        response: {
          evaluation: { isCorrect: false, score: 0 },
          coach: { message: 'Not quite. Try solving it once more before using a hint.', nextAction: 'TRY_AGAIN' },
          ui: { canTryAgain: true, canRevealSolution: false, hintLevel: 0 },
          position: 0,
          totalCount: 2,
          sessionStatus: 'in_progress',
        },
      })
      .mockResolvedValueOnce({
        type: 'ok',
        response: {
          evaluation: { isCorrect: false, score: 0 },
          coach: { message: "Good effort. Here's a hint to help you.", nextAction: 'SHOW_HINT' },
          ui: { canTryAgain: true, canRevealSolution: false, hintLevel: 1 },
          position: 0,
          totalCount: 2,
          sessionStatus: 'in_progress',
        },
      })
      .mockResolvedValueOnce({
        type: 'ok',
        response: {
          evaluation: { isCorrect: false, score: 0 },
          coach: { message: "If you're still stuck, you can view the solution.", nextAction: 'SHOW_SOLUTION' },
          ui: { canTryAgain: false, canRevealSolution: true, hintLevel: 2 },
          position: 1,
          totalCount: 2,
          sessionStatus: 'in_progress',
        },
      });

    render(<SessionQuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');

    const answerBox = screen.getByPlaceholderText('Type your answer');
    const submit = screen.getByRole('button', { name: 'Check Answer' });

    // Three genuine wrong submissions - no hint ever clicked.
    fireEvent.change(answerBox, { target: { value: 'wrong' } });
    fireEvent.click(submit);
    await screen.findByText('Not quite. Try solving it once more before using a hint.');

    fireEvent.change(answerBox, { target: { value: 'wrong' } });
    fireEvent.click(submit);
    await screen.findByText("Good effort. Here's a hint to help you.");

    fireEvent.change(answerBox, { target: { value: 'wrong' } });
    fireEvent.click(submit);
    await screen.findByText("If you're still stuck, you can view the solution.");

    // The ladder reached SHOW_SOLUTION on its own - the button is visible
    // (ui.canRevealSolution is true) but must not issue a second POST.
    const revealButton = await screen.findByRole('button', { name: 'Reveal Solution' });
    fireEvent.click(revealButton);

    expect(sessionService.revealSolution).not.toHaveBeenCalled();
    await screen.findByText('x = 18'); // the solution is still shown, acknowledged locally
    const nextButton = await screen.findByRole('button', { name: 'Next Question' });

    vi.mocked(sessionService.getCurrentQuestion).mockResolvedValue({
      type: 'question',
      question: { position: 1, totalCount: 2, question: secondQuestionContent },
    });

    fireEvent.click(nextButton);

    await screen.findByText('Solve for x: 3x = 12');
    expect(screen.queryByText('Solve for x: 2x = 36')).not.toBeInTheDocument();
    expect(screen.queryByText('x = 18')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your answer')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Need a Hint' })).toBeInTheDocument();
  });
});

describe('SessionQuestionPage - reveal solution regression guards (correct/ladder unchanged)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('leaves normal correct-answer advancement unchanged', async () => {
    mockLiveQuestion();
    vi.mocked(sessionService.submitSessionAnswer).mockResolvedValue({
      type: 'ok',
      response: {
        evaluation: { isCorrect: true, score: 1 },
        coach: { message: 'Excellent! You solved it correctly.', nextAction: 'NEXT_QUESTION' },
        ui: { canTryAgain: false, canRevealSolution: false, hintLevel: 0 },
        position: 1,
        totalCount: 1,
        sessionStatus: 'completed',
      },
    });

    render(<SessionQuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    await screen.findByText('Excellent! You solved it correctly.');
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
    expect(sessionService.revealSolution).not.toHaveBeenCalled();
  });

  it('leaves the wrong-answer/hint ladder messages unchanged', async () => {
    mockLiveQuestion();
    vi.mocked(sessionService.submitSessionAnswer)
      .mockResolvedValueOnce({
        type: 'ok',
        response: {
          evaluation: { isCorrect: false, score: 0 },
          coach: { message: 'Not quite. Try solving it once more before using a hint.', nextAction: 'TRY_AGAIN' },
          ui: { canTryAgain: true, canRevealSolution: false, hintLevel: 0 },
          position: 0,
          totalCount: 1,
          sessionStatus: 'in_progress',
        },
      })
      .mockResolvedValueOnce({
        type: 'ok',
        response: {
          evaluation: { isCorrect: false, score: 0 },
          coach: { message: "Good effort. Here's a hint to help you.", nextAction: 'SHOW_HINT' },
          ui: { canTryAgain: true, canRevealSolution: false, hintLevel: 1 },
          position: 0,
          totalCount: 1,
          sessionStatus: 'in_progress',
        },
      });

    render(<SessionQuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');

    const answerBox = screen.getByPlaceholderText('Type your answer');
    const submit = screen.getByRole('button', { name: 'Check Answer' });

    fireEvent.change(answerBox, { target: { value: 'wrong' } });
    fireEvent.click(submit);
    await screen.findByText('Not quite. Try solving it once more before using a hint.');
    expect(screen.queryByRole('button', { name: 'Reveal Solution' })).not.toBeInTheDocument();

    fireEvent.change(answerBox, { target: { value: 'wrong' } });
    fireEvent.click(submit);
    await screen.findByText("Good effort. Here's a hint to help you.");
    expect(screen.queryByRole('button', { name: 'Reveal Solution' })).not.toBeInTheDocument();
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
