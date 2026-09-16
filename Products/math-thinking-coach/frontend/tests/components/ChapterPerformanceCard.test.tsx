import { render, screen, fireEvent, within } from '@testing-library/react';
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

  // D1 — Concept-Level Performance Readout.
  const concepts = [
    { id: 'concept-le-basics', title: 'What is a linear equation?', body: '', learningObjectives: [] },
    { id: 'concept-le-reducing', title: 'Reducing equations to simpler form', body: '', learningObjectives: [] },
  ];

  it('renders no concept breakdown when the chapter has no topic', () => {
    render(<ChapterPerformanceCard chapter={chapter} />);

    expect(screen.queryByText('What is a linear equation?')).not.toBeInTheDocument();
  });

  it('renders no concept breakdown when the topic has no concepts yet', () => {
    render(<ChapterPerformanceCard chapter={chapter} topicId="topic-linear-equations" concepts={[]} />);

    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
  });

  it('shows "Not yet attempted" for a concept with no recorded performance', () => {
    render(
      <ChapterPerformanceCard chapter={chapter} topicId="topic-linear-equations" concepts={concepts} />,
    );

    const item = screen.getByText('What is a linear equation?').closest('li')!;
    expect(within(item).getByText('Not yet attempted')).toBeInTheDocument();
  });

  it('shows correct/attempted for a concept with recorded performance', () => {
    render(
      <ChapterPerformanceCard
        chapter={chapter}
        topicId="topic-linear-equations"
        concepts={concepts}
        conceptPerformance={[
          {
            conceptId: 'concept-le-basics',
            conceptTitle: 'What is a linear equation?',
            topicId: 'topic-linear-equations',
            chapterId: 'linear-equations',
            questionsAttempted: 3,
            questionsCorrect: 2,
            accuracy: 0.6667,
          },
        ]}
      />,
    );

    const item = screen.getByText('What is a linear equation?').closest('li')!;
    expect(within(item).getByText('2/3')).toBeInTheDocument();
  });

  it('separates two concepts on the same le-q30-style cross-concept question correctly', () => {
    // le-q30 spans concept-le-basics and concept-le-reducing - each concept
    // must show its own independent stats, not a merged/shared number.
    render(
      <ChapterPerformanceCard
        chapter={chapter}
        topicId="topic-linear-equations"
        concepts={concepts}
        conceptPerformance={[
          {
            conceptId: 'concept-le-basics',
            conceptTitle: 'What is a linear equation?',
            topicId: 'topic-linear-equations',
            chapterId: 'linear-equations',
            questionsAttempted: 1,
            questionsCorrect: 0,
            accuracy: 0,
          },
          {
            conceptId: 'concept-le-reducing',
            conceptTitle: 'Reducing equations to simpler form',
            topicId: 'topic-linear-equations',
            chapterId: 'linear-equations',
            questionsAttempted: 1,
            questionsCorrect: 0,
            accuracy: 0,
          },
        ]}
      />,
    );

    const basics = screen.getByText('What is a linear equation?').closest('li')!;
    const reducing = screen.getByText('Reducing equations to simpler form').closest('li')!;
    expect(within(basics).getByText('0/1')).toBeInTheDocument();
    expect(within(reducing).getByText('0/1')).toBeInTheDocument();
  });

  it('builds the concept review deep link with the topic id and concept heading anchor', () => {
    render(
      <ChapterPerformanceCard chapter={chapter} topicId="topic-linear-equations" concepts={concepts} />,
    );

    const item = screen.getByText('Reducing equations to simpler form').closest('li')!;
    fireEvent.click(within(item).getByRole('button', { name: 'Review' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/topic/topic-linear-equations?from=dashboard#concept-heading-concept-le-reducing',
    );
  });

  // Self-Serve Learning Loop V1, Slice 1: discoverability CTA into Revision.
  describe('weak-area Revision CTA', () => {
    it('shows no CTA when there is no weak-topic evidence', () => {
      render(<ChapterPerformanceCard chapter={chapter} hasWeakEvidence={false} />);

      expect(screen.queryByRole('button', { name: 'Practise your weak areas' })).toBeNull();
    });

    it('shows no CTA when hasWeakEvidence is not provided at all', () => {
      render(<ChapterPerformanceCard chapter={chapter} />);

      expect(screen.queryByRole('button', { name: 'Practise your weak areas' })).toBeNull();
    });

    it('shows the CTA when genuine weak-topic evidence exists', () => {
      render(<ChapterPerformanceCard chapter={chapter} hasWeakEvidence={true} />);

      expect(screen.getByRole('button', { name: 'Practise your weak areas' })).toBeInTheDocument();
    });

    it('navigates into Start Practice with Revision preselected via navigation state', () => {
      render(<ChapterPerformanceCard chapter={chapter} hasWeakEvidence={true} />);

      fireEvent.click(screen.getByRole('button', { name: 'Practise your weak areas' }));

      expect(mockNavigate).toHaveBeenCalledWith('/practice/linear-equations', {
        state: { presetMode: 'revision' },
      });
    });
  });
});
