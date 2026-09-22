import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ chapterId: 'linear-equations' }),
}));

vi.mock('../../src/services/questionService', () => ({
  questionService: {
    getChapter: vi.fn(),
    getQuestions: vi.fn(),
    submitAnswer: vi.fn(),
  },
}));

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    startLearner: vi.fn(),
  },
}));

import QuestionPage from '../../src/pages/QuestionPage';
import { authService } from '../../src/services/authService';
import { questionService } from '../../src/services/questionService';

const existingUser = { role: 'student' as const, id: 'existing-learner-1', name: null };
const newLearner = { role: 'student' as const, id: 'learner_freshid', name: null };

const chapter = { id: 'linear-equations', title: 'Linear Equations', description: 'D' };
const question = {
  id: 'le-q01',
  chapterId: 'linear-equations',
  question: 'Solve for x: 2x = 36',
  text: 'Solve for x: 2x = 36',
  difficulty: 'Easy' as const,
  hints: ['Divide both sides by 2', 'x is a whole number'],
  solution: 'x = 18',
  questionType: 'short_text' as const,
  responseSpecification: null,
};

const evaluationResponse = {
  evaluation: { isCorrect: true, score: 1 },
  coach: { message: 'Excellent! You solved it correctly.', nextAction: 'NEXT_QUESTION' as const },
  ui: { canTryAgain: false, canRevealSolution: false, hintLevel: 0 },
};

describe('QuestionPage - hint/mastery correctness fix', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // Correctness Integrity slice: currentHintIndex (existing client state)
  // must actually reach the server - previously handleAnswerSubmit sent
  // only {answer, attemptNumber}, so attempts.hints_used was always 0
  // regardless of how many hints were revealed.
  it('submits hintsUsed matching the number of hints revealed', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([question]);
    vi.mocked(questionService.submitAnswer).mockResolvedValue(evaluationResponse);
    // An already-identified learner - not this test's concern, so kept out
    // of the way rather than exercising the fresh-identity path.
    vi.mocked(authService.getCurrentUser).mockResolvedValue(existingUser);

    render(<QuestionPage />);

    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.click(screen.getByRole('button', { name: 'Need a Hint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Next Hint' }));

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    await waitFor(() =>
      expect(questionService.submitAnswer).toHaveBeenCalledWith('le-q01', {
        answer: '18',
        attemptNumber: 1,
        hintsUsed: 2,
      }),
    );
  });

  it('submits hintsUsed: 0 when no hint was revealed', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([question]);
    vi.mocked(questionService.submitAnswer).mockResolvedValue(evaluationResponse);
    vi.mocked(authService.getCurrentUser).mockResolvedValue(existingUser);

    render(<QuestionPage />);

    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    await waitFor(() =>
      expect(questionService.submitAnswer).toHaveBeenCalledWith('le-q01', {
        answer: '18',
        attemptNumber: 1,
        hintsUsed: 0,
      }),
    );
  });
});

describe('QuestionPage - lazy self-serve learner identity (Option D(i) integration)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not check or create an identity merely from viewing the page', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([question]);

    render(<QuestionPage />);

    await screen.findByText('Solve for x: 2x = 36');

    expect(authService.getCurrentUser).not.toHaveBeenCalled();
    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('establishes a self-serve learner identity before the first answer request, in order', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([question]);

    // No existing session - the fresh-learner path.
    const callOrder: string[] = [];
    vi.mocked(authService.getCurrentUser).mockImplementation(async () => {
      callOrder.push('getCurrentUser');
      return undefined;
    });
    vi.mocked(authService.startLearner).mockImplementation(async () => {
      callOrder.push('startLearner');
      return newLearner;
    });
    vi.mocked(questionService.submitAnswer).mockImplementation(async () => {
      callOrder.push('submitAnswer');
      return evaluationResponse;
    });

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    await waitFor(() => expect(questionService.submitAnswer).toHaveBeenCalled());

    // Sequenced, not concurrent: identity must be fully established (both
    // getCurrentUser and, since none existed, startLearner) before the
    // credentialed answer request is ever sent.
    expect(callOrder).toEqual(['getCurrentUser', 'startLearner', 'submitAnswer']);
  });

  it('does not call startLearner when a valid session already exists (self-serve or class-connected)', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([question]);
    vi.mocked(questionService.submitAnswer).mockResolvedValue(evaluationResponse);
    vi.mocked(authService.getCurrentUser).mockResolvedValue(existingUser);

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    await waitFor(() => expect(questionService.submitAnswer).toHaveBeenCalled());

    expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('does not re-check or duplicate identity on a second answer submission in the same page lifetime', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([question]);
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(authService.startLearner).mockResolvedValue(newLearner);

    const tryAgain = {
      evaluation: { isCorrect: false, score: 0 },
      coach: { message: 'Not quite - try again.', nextAction: 'TRY_AGAIN' as const },
      ui: { canTryAgain: true, canRevealSolution: false, hintLevel: 0 },
    };
    vi.mocked(questionService.submitAnswer)
      .mockResolvedValueOnce(tryAgain)
      .mockResolvedValueOnce(evaluationResponse);

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '17' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
    await waitFor(() => expect(questionService.submitAnswer).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
    await waitFor(() => expect(questionService.submitAnswer).toHaveBeenCalledTimes(2));

    // Identity was established once for the page's lifetime, not once per
    // submission - a fresh learner must not accumulate multiple learner rows.
    expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(authService.startLearner).toHaveBeenCalledTimes(1);
  });
});

describe('QuestionPage - saving note for a newly created identity (S4a)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const NOTE = "We're now saving your practice in this browser.";
  const question2 = { ...question, id: 'le-q02', question: 'Solve for x: 3x = 9', text: 'Solve for x: 3x = 9' };

  function setup(questions = [question]) {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue(questions);
  }

  function submit() {
    fireEvent.change(screen.getByPlaceholderText('Type your answer'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));
  }

  it('is not shown before an evaluation exists', async () => {
    setup();
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(authService.startLearner).mockResolvedValue(newLearner);
    vi.mocked(questionService.submitAnswer).mockReturnValue(new Promise(() => {}));

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();

    submit();
    await waitFor(() => expect(questionService.submitAnswer).toHaveBeenCalled());
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('is shown once after the first successful evaluation of a new learner, as a polite live region with no link', async () => {
    setup();
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(authService.startLearner).mockResolvedValue(newLearner);
    vi.mocked(questionService.submitAnswer).mockResolvedValue(evaluationResponse);

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');
    submit();

    const note = await screen.findByText(NOTE);
    expect(screen.getAllByText(NOTE)).toHaveLength(1);
    expect(note).toHaveAttribute('aria-live', 'polite');
    expect(note.closest('a')).toBeNull();
    expect(note.querySelector('a')).toBeNull();
    expect(Object.keys(localStorage)).toEqual(['mtc.progress.v1']);
  });

  it('is not shown for an existing student', async () => {
    setup();
    vi.mocked(authService.getCurrentUser).mockResolvedValue(existingUser);
    vi.mocked(questionService.submitAnswer).mockResolvedValue(evaluationResponse);

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');
    submit();

    await screen.findByText(evaluationResponse.coach.message);
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('is not shown for a teacher', async () => {
    setup();
    vi.mocked(authService.getCurrentUser).mockResolvedValue({ role: 'teacher', id: 't1', name: 'T' } as never);
    vi.mocked(questionService.submitAnswer).mockResolvedValue(evaluationResponse);

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');
    submit();

    await screen.findByText(evaluationResponse.coach.message);
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('is not shown when startLearner fails', async () => {
    setup();
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(authService.startLearner).mockRejectedValue(new Error('down'));

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');
    submit();

    await screen.findByText(/couldn't check your answer/i);
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    expect(questionService.submitAnswer).not.toHaveBeenCalled();
  });

  it('is not shown when the evaluation fails, but shows on the first later success', async () => {
    setup();
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(authService.startLearner).mockResolvedValue(newLearner);
    vi.mocked(questionService.submitAnswer)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(evaluationResponse);

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');
    submit();

    await screen.findByText(/couldn't check your answer/i);
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();

    submit();
    await screen.findByText(NOTE);
    expect(screen.getAllByText(NOTE)).toHaveLength(1);
    expect(authService.startLearner).toHaveBeenCalledTimes(1);
  });

  it('is cleared on Next Question and never re-armed', async () => {
    setup([question, question2]);
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(authService.startLearner).mockResolvedValue(newLearner);
    vi.mocked(questionService.submitAnswer).mockResolvedValue(evaluationResponse);

    render(<QuestionPage />);
    await screen.findByText('Solve for x: 2x = 36');
    submit();
    await screen.findByText(NOTE);

    fireEvent.click(screen.getByRole('button', { name: 'Next Question' }));
    await screen.findByText('Solve for x: 3x = 9');
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();

    submit();
    await screen.findByText(evaluationResponse.coach.message);
    expect(questionService.submitAnswer).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});
