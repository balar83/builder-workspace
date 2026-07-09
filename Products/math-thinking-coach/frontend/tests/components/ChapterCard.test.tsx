import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import ChapterCard from '../../src/components/ChapterCard';

describe('ChapterCard', () => {
  it('navigates to question page on click', () => {
    render(<ChapterCard chapter={{ id: 'r', title: 'T', description: 'D' }} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/question/r');
  });
});
