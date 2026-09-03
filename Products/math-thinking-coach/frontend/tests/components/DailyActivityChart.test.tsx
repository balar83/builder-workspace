import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DailyActivityChart from '../../src/components/DailyActivityChart';
import type { DailyActivityDay } from '../../src/services/dailyActivity';

function makeDays(overrides: Partial<DailyActivityDay>[]): DailyActivityDay[] {
  const base = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03'];
  return base.map((date, index) => ({
    date,
    questionsAttempted: 0,
    questionsCorrect: 0,
    ...overrides[index],
  }));
}

describe('DailyActivityChart', () => {
  it('shows the empty-week message when there is no activity at all', () => {
    render(<DailyActivityChart days={makeDays([])} />);

    expect(screen.getByText(/No practice recorded in the last 7 days/)).toBeInTheDocument();
  });

  it('labels the most recent day "Today" and shows its attempted count', () => {
    const days = makeDays([{}, {}, {}, {}, {}, {}, { questionsAttempted: 5, questionsCorrect: 3 }]);

    render(<DailyActivityChart days={days} />);

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows the solved count as smaller secondary text, not the primary label', () => {
    const days = makeDays([{}, {}, {}, {}, {}, {}, { questionsAttempted: 4, questionsCorrect: 2 }]);

    render(<DailyActivityChart days={days} />);

    // Primary: the attempted count is shown plainly.
    expect(screen.getByText('4')).toBeInTheDocument();
    // Secondary: solved count is a distinctly-worded, separate caption.
    expect(screen.getByText('2 solved')).toBeInTheDocument();
  });

  it('omits the "solved" caption for a day with zero questions solved', () => {
    const days = makeDays([{}, {}, {}, {}, {}, {}, { questionsAttempted: 2, questionsCorrect: 0 }]);

    render(<DailyActivityChart days={days} />);

    expect(screen.queryByText('0 solved')).not.toBeInTheDocument();
  });
});
