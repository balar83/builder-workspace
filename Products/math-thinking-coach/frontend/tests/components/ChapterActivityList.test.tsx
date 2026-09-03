import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChapterActivityList from '../../src/components/ChapterActivityList';
import type { ChapterActivity } from '../../src/types/activity';

describe('ChapterActivityList', () => {
  it('renders a zero-activity chapter with all-zero stats and "Not yet practiced", no accuracy suffix', () => {
    const chapters: ChapterActivity[] = [
      {
        chapterId: 'practical-geometry',
        chapterTitle: 'Practical Geometry',
        questionsAttempted: 0,
        questionsCorrect: 0,
        accuracy: 0,
        lastActivityAt: null,
      },
    ];

    render(<ChapterActivityList chapters={chapters} />);

    expect(screen.getByText('Practical Geometry')).toBeInTheDocument();
    expect(screen.getByText('0 practiced · 0 solved')).toBeInTheDocument();
    expect(screen.getByText('Not yet practiced')).toBeInTheDocument();
  });

  it('renders an active chapter with its accuracy suffix and a formatted last-practiced date', () => {
    const chapters: ChapterActivity[] = [
      {
        chapterId: 'rational-numbers',
        chapterTitle: 'Rational Numbers',
        questionsAttempted: 4,
        questionsCorrect: 3,
        accuracy: 0.75,
        lastActivityAt: '2026-09-01T10:00:00.000Z',
      },
    ];

    render(<ChapterActivityList chapters={chapters} />);

    expect(screen.getByText('4 practiced · 3 solved · 75%')).toBeInTheDocument();
    expect(screen.getByText(/^Last practiced/)).toBeInTheDocument();
  });

  it('renders both a zero-activity and an active chapter side by side, curriculum-coverage style', () => {
    const chapters: ChapterActivity[] = [
      {
        chapterId: 'rational-numbers',
        chapterTitle: 'Rational Numbers',
        questionsAttempted: 2,
        questionsCorrect: 1,
        accuracy: 0.5,
        lastActivityAt: '2026-09-01T10:00:00.000Z',
      },
      {
        chapterId: 'practical-geometry',
        chapterTitle: 'Practical Geometry',
        questionsAttempted: 0,
        questionsCorrect: 0,
        accuracy: 0,
        lastActivityAt: null,
      },
    ];

    render(<ChapterActivityList chapters={chapters} />);

    expect(screen.getByText('Rational Numbers')).toBeInTheDocument();
    expect(screen.getByText('Practical Geometry')).toBeInTheDocument();
    expect(screen.getByText('Not yet practiced')).toBeInTheDocument();
  });
});
