import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import ChapterCard from '../../src/components/ChapterCard';
import { progressService } from '../../src/services/progressService';

describe('ChapterCard', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('navigates to the chapter overview page on click', () => {
    render(<ChapterCard chapter={{ id: 'r', title: 'T', description: 'D' }} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/chapter/r');
  });

  it('shows no progress badge when the chapter has no recorded progress', () => {
    render(<ChapterCard chapter={{ id: 'r', title: 'T', description: 'D' }} />);

    expect(screen.queryByText(/completed/)).not.toBeInTheDocument();
  });

  it('shows a completed count badge when the chapter has completed questions', () => {
    progressService.recordQuestionCompleted('r', 'q1');
    progressService.recordQuestionCompleted('r', 'q2');

    render(<ChapterCard chapter={{ id: 'r', title: 'T', description: 'D' }} />);

    expect(screen.getByText('2 completed')).toBeInTheDocument();
  });
});
