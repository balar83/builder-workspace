import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../src/services/progressService', () => ({
  progressService: {
    getLastActiveChapter: vi.fn(() => null),
  },
}));

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    startLearner: vi.fn(),
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

import HomePage from '../../src/pages/HomePage';
import { authService } from '../../src/services/authService';
import { progressService } from '../../src/services/progressService';
import { sessionPointerService } from '../../src/services/sessionPointerService';
import { sessionService } from '../../src/services/sessionService';

describe('HomePage - "My Progress" entry point (Progress Hub V1)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not create any identity merely by rendering the page', () => {
    render(<HomePage />);

    expect(authService.getCurrentUser).not.toHaveBeenCalled();
    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('establishes a fresh learner identity before navigating to Dashboard, in that order', async () => {
    const callOrder: string[] = [];
    vi.mocked(authService.getCurrentUser).mockImplementation(async () => {
      callOrder.push('getCurrentUser');
      return undefined;
    });
    vi.mocked(authService.startLearner).mockImplementation(async () => {
      callOrder.push('startLearner');
      return { role: 'student' as const, id: 'learner_fresh', name: null };
    });

    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'My Progress' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));

    expect(callOrder).toEqual(['getCurrentUser', 'startLearner']);
  });

  it('reuses an existing session without creating a duplicate learner', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      role: 'student',
      id: 'existing-learner',
      name: null,
    });

    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'My Progress' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));

    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('shows an error and does not navigate when identity establishment fails', async () => {
    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('network down'));

    render(<HomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'My Progress' }));

    await screen.findByText(/couldn't open your progress/i);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('leaves the existing Continue Learning / Select Chapter buttons unaffected', () => {
    render(<HomePage />);

    expect(screen.getByRole('button', { name: 'Continue Learning' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Chapter' })).toBeInTheDocument();
  });
});

describe('HomePage - Continue Learning (S2)', () => {
  const student = { role: 'student' as const, id: 'student-1', name: null };
  const pointer = { studentId: 'student-1', sessionId: 'sess-9', chapterId: 'linear-equations', mode: 'practice' as const };
  const summaryOf = (status: string) => ({
    type: 'ok' as const,
    summary: { sessionId: 'sess-9', mode: 'practice', status, position: 0, totalCount: 1, correctCount: 0, startedAt: null, completedAt: null, timeLimitMinutes: null },
  });

  const clickContinue = () => fireEvent.click(screen.getByRole('button', { name: 'Continue Learning' }));

  afterEach(() => {
    vi.resetAllMocks();
    vi.mocked(progressService.getLastActiveChapter).mockReturnValue(null);
  });

  it('never looks anything up or creates identity on render', () => {
    render(<HomePage />);

    expect(authService.getCurrentUser).not.toHaveBeenCalled();
    expect(sessionPointerService.getActiveSessionFor).not.toHaveBeenCalled();
    expect(sessionService.getSessionSummary).not.toHaveBeenCalled();
  });

  it('falls back to /chapters with no identity and no last chapter, without creating identity', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/chapters'));
    expect(authService.startLearner).not.toHaveBeenCalled();
    expect(sessionPointerService.getActiveSessionFor).not.toHaveBeenCalled();
  });

  it('falls back to the last active chapter with no identity', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(progressService.getLastActiveChapter).mockReturnValue('fractions');
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/chapter/fractions'));
  });

  it.each(['in_progress', 'not_started'])('resumes a live %s session', async (status) => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(student);
    vi.mocked(sessionPointerService.getActiveSessionFor).mockReturnValue(pointer);
    vi.mocked(sessionService.getSessionSummary).mockResolvedValue(summaryOf(status) as never);
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/session/sess-9'));
    expect(sessionPointerService.getActiveSessionFor).toHaveBeenCalledWith('student-1');
    expect(sessionPointerService.clearActiveSession).not.toHaveBeenCalled();
    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it.each(['completed', 'expired', 'abandoned'])('clears the pointer and goes to Dashboard for a %s session', async (status) => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(student);
    vi.mocked(sessionPointerService.getActiveSessionFor).mockReturnValue(pointer);
    vi.mocked(sessionService.getSessionSummary).mockResolvedValue(summaryOf(status) as never);
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    expect(sessionPointerService.clearActiveSession).toHaveBeenCalledTimes(1);
  });

  it('clears the pointer and goes to Dashboard when the session is not found', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(student);
    vi.mocked(sessionPointerService.getActiveSessionFor).mockReturnValue(pointer);
    vi.mocked(sessionService.getSessionSummary).mockResolvedValue({ type: 'not-found' });
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    expect(sessionPointerService.clearActiveSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the pointer and goes to Dashboard when the summary lookup throws', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(student);
    vi.mocked(sessionPointerService.getActiveSessionFor).mockReturnValue(pointer);
    vi.mocked(sessionService.getSessionSummary).mockRejectedValue(new Error('down'));
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    expect(sessionPointerService.clearActiveSession).not.toHaveBeenCalled();
  });

  it('goes to Dashboard when a student has no pointer (including another student\'s pointer)', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(student);
    vi.mocked(sessionPointerService.getActiveSessionFor).mockReturnValue(undefined);
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    expect(sessionService.getSessionSummary).not.toHaveBeenCalled();
    expect(sessionPointerService.clearActiveSession).not.toHaveBeenCalled();
  });

  it('uses the localStorage fallback for a teacher', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue({ role: 'teacher', id: 't1', name: 'T' } as never);
    vi.mocked(progressService.getLastActiveChapter).mockReturnValue('fractions');
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/chapter/fractions'));
    expect(sessionPointerService.getActiveSessionFor).not.toHaveBeenCalled();
  });

  it('uses the localStorage fallback when getCurrentUser rejects', async () => {
    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('down'));
    render(<HomePage />);
    clickContinue();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/chapters'));
    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('is disabled while pending, with an unchanged label, and re-enables afterwards', async () => {
    let resolveUser: (value: undefined) => void = () => {};
    vi.mocked(authService.getCurrentUser).mockReturnValue(new Promise((resolve) => { resolveUser = resolve; }));
    render(<HomePage />);
    clickContinue();

    const button = screen.getByRole('button', { name: 'Continue Learning' });
    expect(button).toBeDisabled();
    clickContinue();
    expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);

    resolveUser(undefined);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/chapters'));
    await waitFor(() => expect(button).toBeEnabled());
  });
});
