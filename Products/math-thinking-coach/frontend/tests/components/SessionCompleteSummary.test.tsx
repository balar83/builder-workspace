import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SessionCompleteSummary from '../../src/components/SessionCompleteSummary';

describe('SessionCompleteSummary', () => {
  it('shows no score for practice mode, even when it completed successfully', () => {
    render(<SessionCompleteSummary mode="practice" status="completed" correctCount={4} totalCount={5} />);

    expect(screen.queryByText(/4 of 5/)).not.toBeInTheDocument();
    expect(screen.getByText(/worked through 5 questions/)).toBeInTheDocument();
  });

  it('shows no score for revision mode', () => {
    render(<SessionCompleteSummary mode="revision" status="completed" correctCount={2} totalCount={3} />);

    expect(screen.queryByText(/2 of 3/)).not.toBeInTheDocument();
  });

  it('shows the score for test mode - the one place a score appears', () => {
    render(<SessionCompleteSummary mode="test" status="completed" correctCount={3} totalCount={5} />);

    expect(screen.getByText(/3 of 5/)).toBeInTheDocument();
  });

  it('shows expired-specific status copy', () => {
    render(<SessionCompleteSummary mode="test" status="expired" correctCount={1} totalCount={5} />);

    expect(screen.getByText(/Time's up/)).toBeInTheDocument();
  });

  it('shows abandoned-specific status copy', () => {
    render(<SessionCompleteSummary mode="practice" status="abandoned" correctCount={0} totalCount={5} />);

    expect(screen.getByText(/went inactive/)).toBeInTheDocument();
  });
});
