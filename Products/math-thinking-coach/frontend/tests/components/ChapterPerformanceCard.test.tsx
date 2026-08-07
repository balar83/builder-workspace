import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import ChapterPerformanceCard from '../../src/components/ChapterPerformanceCard';

const chapter = { id: 'linear-equations', title: 'Linear Equations', description: 'D' };

describe('ChapterPerformanceCard', () => {
  afterEach(() => {
    mockNavigate.mockClear();
  });

  it('shows no performance badge when no performance is recorded yet', () => {
    render(<ChapterPerformanceCard chapter={chapter} />);

    expect(screen.queryByText(/attempted/)).not.toBeInTheDocument();
  });

  it('shows attempted count and accuracy when performance exists', () => {
    render(
      <ChapterPerformanceCard
        chapter={chapter}
        performance={{
          topicId: 'linear-equations',
          questionsAttempted: 4,
          questionsCorrect: 3,
          accuracy: 0.75,
          currentStreak: 2,
          mastered: false,
        }}
      />,
    );

    expect(screen.getByText('4 attempted · 75% accuracy')).toBeInTheDocument();
  });

  it('shows a Mastered indicator when the topic is mastered', () => {
    render(
      <ChapterPerformanceCard
        chapter={chapter}
        performance={{
          topicId: 'linear-equations',
          questionsAttempted: 6,
          questionsCorrect: 6,
          accuracy: 1,
          currentStreak: 3,
          mastered: true,
        }}
      />,
    );

    expect(screen.getByText('6 attempted · 100% accuracy · Mastered')).toBeInTheDocument();
  });

  it('navigates to the practice configuration page on Start Practice', () => {
    render(<ChapterPerformanceCard chapter={chapter} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));

    expect(mockNavigate).toHaveBeenCalledWith('/practice/linear-equations');
  });

  // Release 0.1.2 (UX review IA-1): before this, /topic/:topicId was
  // reachable only from the anonymous chapter page, so a logged-in student
  // could never reach the lesson content at all.
  it('offers a Learn action only for chapters that have a topic', () => {
    const { rerender } = render(<ChapterPerformanceCard chapter={chapter} />);
    expect(screen.queryByRole('button', { name: 'Learn' })).toBeNull();

    rerender(<ChapterPerformanceCard chapter={chapter} topicId="topic-linear-equations" />);
    fireEvent.click(screen.getByRole('button', { name: 'Learn' }));

    expect(mockNavigate).toHaveBeenCalledWith('/topic/topic-linear-equations?from=dashboard');
  });
});
