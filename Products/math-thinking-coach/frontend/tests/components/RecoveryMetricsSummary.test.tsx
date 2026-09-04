import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RecoveryMetricsSummary from '../../src/components/RecoveryMetricsSummary';
import type { RecoveryMetric } from '../../src/types/recovery';

const NO_EVIDENCE: RecoveryMetric = { recovered: 0, initiallyWrong: 0, rate: null, sufficientSample: false };
const INSUFFICIENT: RecoveryMetric = { recovered: 1, initiallyWrong: 2, rate: null, sufficientSample: false };
const SUFFICIENT: RecoveryMetric = { recovered: 3, initiallyWrong: 4, rate: 0.75, sufficientSample: true };

describe('RecoveryMetricsSummary', () => {
  it('shows an explicit no-evidence message for a window with no wrong first attempts, never a 0%', () => {
    render(<RecoveryMetricsSummary lifetime={NO_EVIDENCE} recent={NO_EVIDENCE} hasRecentActivity={true} />);

    expect(screen.getAllByText('No wrong first attempts yet.')).toHaveLength(2);
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
  });

  it('shows counts and an explicit insufficient-evidence message when sample is too small, never a fabricated rate', () => {
    render(<RecoveryMetricsSummary lifetime={INSUFFICIENT} recent={NO_EVIDENCE} hasRecentActivity={true} />);

    expect(
      screen.getByText('1 of 2 recovered so far — not enough evidence yet for a reliable rate.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows the actual recovery rate and underlying counts once the sample is sufficient', () => {
    render(<RecoveryMetricsSummary lifetime={SUFFICIENT} recent={NO_EVIDENCE} hasRecentActivity={true} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('(3 of 4)')).toBeInTheDocument();
  });

  it('labels lifetime and recent as visually and semantically distinct windows', () => {
    render(<RecoveryMetricsSummary lifetime={SUFFICIENT} recent={INSUFFICIENT} hasRecentActivity={true} />);

    expect(screen.getByRole('heading', { name: 'Lifetime' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Last 7 Days' })).toBeInTheDocument();
    // Lifetime shows the sufficient-sample rate; recent shows the
    // insufficient-evidence message - proving they render independently,
    // not from a single shared/merged state.
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(
      screen.getByText('1 of 2 recovered so far — not enough evidence yet for a reliable rate.'),
    ).toBeInTheDocument();
  });

  it('shows an explicit no-recent-activity message when hasRecentActivity is false, never the recent metric as if current', () => {
    // A misconfigured/inconsistent recent metric (non-zero counts) proves
    // hasRecentActivity gates the recent window independently of its own
    // field values - the recent metric itself must never be trusted to
    // signal "no recent activity" on its own.
    render(<RecoveryMetricsSummary lifetime={SUFFICIENT} recent={SUFFICIENT} hasRecentActivity={false} />);

    expect(screen.getByText('No practice in the last 7 days.')).toBeInTheDocument();
    // Only the lifetime block's rate renders; the recent block's numbers do not.
    expect(screen.getAllByText('75%')).toHaveLength(1);
  });
});
