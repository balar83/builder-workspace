import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import MistakeList from '../../src/components/MistakeList';
import type { UnresolvedMistake } from '../../src/types/mistake';

const mistake: UnresolvedMistake = {
  questionId: 'rn-q01',
  chapterId: 'rational-numbers',
  chapterTitle: 'Rational Numbers',
  topicId: 'topic-rational-numbers-properties-and-operations',
  lastAttemptAt: '2026-09-01T10:00:00.000Z',
};

describe('MistakeList', () => {
  it('shows an explicit positive empty state when there are no unresolved mistakes, never a silent blank', () => {
    render(<MistakeList mistakes={[]} />);

    expect(screen.getByText('No unresolved mistakes.')).toBeInTheDocument();
  });

  it('renders an unresolved mistake with its chapter title and last-attempted date', () => {
    render(<MistakeList mistakes={[mistake]} />);

    expect(screen.getByText('Rational Numbers')).toBeInTheDocument();
    expect(screen.getByText(/^Last attempted/)).toBeInTheDocument();
  });

  it('never renders the raw topicId slug', () => {
    render(<MistakeList mistakes={[mistake]} />);

    expect(screen.queryByText(mistake.topicId as string)).not.toBeInTheDocument();
  });

  it('renders one row per mistake, including multiple in the same chapter', () => {
    const second: UnresolvedMistake = { ...mistake, questionId: 'rn-q02' };
    render(<MistakeList mistakes={[mistake, second]} />);

    expect(screen.getAllByText('Rational Numbers')).toHaveLength(2);
  });

  it('offers only an honest chapter-level action, never exact-question language', () => {
    render(<MistakeList mistakes={[mistake]} />);

    const button = screen.getByRole('button', { name: 'Practice this chapter' });
    expect(button).toBeInTheDocument();
    expect(screen.queryByText(/fix this mistake/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/retry this question/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/this exact question/i)).not.toBeInTheDocument();
  });

  it('navigates to the chapter-level practice route, never a question-specific route', () => {
    render(<MistakeList mistakes={[mistake]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Practice this chapter' }));

    expect(mockNavigate).toHaveBeenCalledWith('/practice/rational-numbers');
  });
});
