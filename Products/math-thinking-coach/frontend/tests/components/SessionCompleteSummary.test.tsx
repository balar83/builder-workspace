import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SessionCompleteSummary from '../../src/components/SessionCompleteSummary';

describe('SessionCompleteSummary', () => {
  it('completed + practice: friendly coaching message, no score', () => {
    render(<SessionCompleteSummary mode="practice" status="completed" correctCount={4} totalCount={5} />);

    expect(screen.getByText('Nicely done!')).toBeInTheDocument();
    expect(screen.queryByText(/4 of 5/)).not.toBeInTheDocument();
    expect(screen.getByText(/worked through 5 questions/)).toBeInTheDocument();
  });

  it('completed + revision: friendly coaching message, no score', () => {
    render(<SessionCompleteSummary mode="revision" status="completed" correctCount={2} totalCount={3} />);

    expect(screen.getByText('Nicely done!')).toBeInTheDocument();
    expect(screen.queryByText(/2 of 3/)).not.toBeInTheDocument();
  });

  it('completed + test: the existing test summary, the one place a score appears', () => {
    render(<SessionCompleteSummary mode="test" status="completed" correctCount={3} totalCount={5} />);

    expect(screen.getByText('Session complete!')).toBeInTheDocument();
    expect(screen.getByText(/3 of 5/)).toBeInTheDocument();
  });

  it('expired: explains the time limit was reached, and shows the score (expiry only ever happens in Test mode)', () => {
    render(<SessionCompleteSummary mode="test" status="expired" correctCount={1} totalCount={5} />);

    expect(screen.getByText("Time's up!")).toBeInTheDocument();
    expect(screen.getByText(/time limit was reached/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 5/)).toBeInTheDocument();
  });

  it('abandoned: explains the session went inactive, mode-agnostic, no score even for practice', () => {
    render(<SessionCompleteSummary mode="practice" status="abandoned" correctCount={0} totalCount={5} />);

    expect(screen.getByText('Session closed')).toBeInTheDocument();
    expect(screen.getByText(/inactive for a while/)).toBeInTheDocument();
    expect(screen.queryByText(/0 of 5/)).not.toBeInTheDocument();
  });

  it('abandoned: still no score shown even for test mode', () => {
    render(<SessionCompleteSummary mode="test" status="abandoned" correctCount={2} totalCount={5} />);

    expect(screen.getByText('Session closed')).toBeInTheDocument();
    expect(screen.queryByText(/2 of 5/)).not.toBeInTheDocument();
  });

  it('the four cases produce four distinct headings', () => {
    const headings = [
      { mode: 'practice', status: 'completed' },
      { mode: 'test', status: 'completed' },
      { mode: 'test', status: 'expired' },
      { mode: 'practice', status: 'abandoned' },
    ].map(({ mode, status }) => {
      const { unmount } = render(
        <SessionCompleteSummary
          mode={mode as 'practice' | 'test'}
          status={status as 'completed' | 'expired' | 'abandoned'}
          correctCount={1}
          totalCount={2}
        />,
      );
      const heading = document.querySelector('.session-complete-status')?.textContent;
      unmount();
      return heading;
    });

    expect(new Set(headings).size).toBe(4);
  });
});
