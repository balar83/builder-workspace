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

import HomePage from '../../src/pages/HomePage';
import { authService } from '../../src/services/authService';

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
