import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChapterPerformanceCard from '../../src/components/ChapterPerformanceCard';

const chapter = { id: 'linear-equations', title: 'Linear Equations', description: 'D' };

describe('ChapterPerformanceCard', () => {
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

  it('renders the Start Practice button as disabled', () => {
    render(<ChapterPerformanceCard chapter={chapter} />);

    expect(screen.getByRole('button', { name: 'Start Practice' })).toBeDisabled();
  });
});
