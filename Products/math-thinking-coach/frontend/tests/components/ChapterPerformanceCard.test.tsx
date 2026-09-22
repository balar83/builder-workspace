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

  // S5 - Derived Chapter Progress. Counts come only from the chapter's
  // DISTINCT-question activity entry; performance contributes only its
  // existing mastered flag, never its row-counted attempts/accuracy.
  describe('derived chapter progress status line', () => {
    function activity(questionsAttempted: number, questionsCorrect: number) {
      return {
        chapterId: 'linear-equations',
        chapterTitle: 'Linear Equations',
        questionsAttempted,
        questionsCorrect,
        accuracy: questionsAttempted ? questionsCorrect / questionsAttempted : 0,
        lastActivityAt: questionsAttempted ? '2026-09-20T10:00:00+00:00' : null,
      };
    }

    // Row counts deliberately differ from the distinct activity counts, so
    // any leak of the old row-counted badge would be visible.
    function performance(mastered: boolean) {
      return {
        topicId: 'topic-linear-equations',
        questionsAttempted: 9,
        questionsCorrect: 7,
        accuracy: 0.7778,
        currentStreak: mastered ? 3 : 0,
        mastered,
      };
    }

    function statusLine(container: HTMLElement) {
      return container.querySelector('.chapter-progress-badge');
    }

    it('shows "Not started" for zero attempts, with no tried/solved counts', () => {
      const { container } = render(<ChapterPerformanceCard chapter={chapter} activity={activity(0, 0)} />);

      expect(statusLine(container)).toHaveTextContent(/^Not started$/);
      expect(screen.queryByText(/tried|solved/)).not.toBeInTheDocument();
    });

    it('shows In progress with distinct counts when attempted but not mastered', () => {
      const { container } = render(
        <ChapterPerformanceCard chapter={chapter} activity={activity(3, 1)} performance={performance(false)} />,
      );

      expect(statusLine(container)).toHaveTextContent(/^In progress · 3 tried · 1 solved$/);
    });

    it('shows Mastered with distinct counts only when the existing mastered flag is true', () => {
      const { container } = render(
        <ChapterPerformanceCard chapter={chapter} activity={activity(5, 5)} performance={performance(true)} />,
      );

      expect(statusLine(container)).toHaveTextContent(/^Mastered · 5 tried · 5 solved$/);
    });

    it('shows In progress, never Mastered, for a no-topic chapter with activity', () => {
      const { container } = render(<ChapterPerformanceCard chapter={chapter} activity={activity(4, 4)} />);

      expect(statusLine(container)).toHaveTextContent(/^In progress · 4 tried · 4 solved$/);
      expect(screen.queryByText(/Mastered/)).not.toBeInTheDocument();
    });

    it('shows "Not started" for zero attempts even if mastered is unexpectedly true', () => {
      const { container } = render(
        <ChapterPerformanceCard chapter={chapter} activity={activity(0, 0)} performance={performance(true)} />,
      );

      expect(statusLine(container)).toHaveTextContent(/^Not started$/);
      expect(screen.queryByText(/Mastered/)).not.toBeInTheDocument();
    });

    it('renders no status line at all when there is no activity entry', () => {
      const { container } = render(<ChapterPerformanceCard chapter={chapter} performance={performance(true)} />);

      expect(statusLine(container)).toBeNull();
      expect(screen.queryByText(/Not started|In progress|Mastered/)).not.toBeInTheDocument();
    });

    it('never renders the old row-counted badge or any percentage', () => {
      const { container } = render(
        <ChapterPerformanceCard chapter={chapter} activity={activity(3, 1)} performance={performance(true)} />,
      );

      expect(container).not.toHaveTextContent(/attempted/);
      expect(container).not.toHaveTextContent(/accuracy/);
      expect(container).not.toHaveTextContent(/%/);
      expect(container).not.toHaveTextContent(/\b9\b/);
    });

    it('uses no readiness, exam, grade, rank, denominator or recency language', () => {
      for (const [attempted, correct, mastered] of [
        [0, 0, false],
        [3, 1, false],
        [5, 5, true],
      ] as const) {
        const { container, unmount } = render(
          <ChapterPerformanceCard
            chapter={chapter}
            activity={activity(attempted, correct)}
            performance={performance(mastered)}
          />,
        );

        const text = statusLine(container)!.textContent!;
        expect(text).not.toMatch(/ready|exam|grade|rank|score|level|of 60|Last practiced/i);
        unmount();
      }
    });
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
