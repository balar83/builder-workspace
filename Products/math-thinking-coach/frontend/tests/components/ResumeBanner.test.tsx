import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import ResumeBanner from '../../src/components/ResumeBanner';

describe('ResumeBanner', () => {
  afterEach(() => {
    mockNavigate.mockClear();
  });

  it('shows the chapter title', () => {
    render(<ResumeBanner chapterTitle="Linear Equations" sessionId="session-1" />);

    expect(screen.getByText(/Linear Equations/)).toBeInTheDocument();
  });

  it('navigates to the session on click', () => {
    render(<ResumeBanner chapterTitle="Linear Equations" sessionId="session-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Resume Session' }));

    expect(mockNavigate).toHaveBeenCalledWith('/session/session-1');
  });
});
