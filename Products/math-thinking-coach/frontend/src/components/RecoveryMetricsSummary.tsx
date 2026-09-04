import type { RecoveryMetric } from '../types/recovery';
import './RecoveryMetricsSummary.css';

export interface RecoveryMetricsSummaryProps {
  lifetime: RecoveryMetric;
  recent: RecoveryMetric;
  // Explicit "no recent activity" signal from the backend - gates the
  // recent window separately from its own metric values, so an empty
  // recent window is never rendered as if it were a current, up-to-date
  // (if unremarkable) recovery rate.
  hasRecentActivity: boolean;
}

// All three states are distinguished from the raw fields alone, exactly as
// backend/app/schemas/performance.py's RecoveryMetric docstring specifies -
// no threshold or rate is computed here, only rendered.
function RecoveryMetricRow({ metric }: { metric: RecoveryMetric }) {
  if (metric.initiallyWrong === 0) {
    return <p className="recovery-metric-empty">No wrong first attempts yet.</p>;
  }

  if (!metric.sufficientSample || metric.rate === null) {
    return (
      <p className="recovery-metric-insufficient">
        {metric.recovered} of {metric.initiallyWrong} recovered so far — not enough evidence yet for a reliable rate.
      </p>
    );
  }

  return (
    <p className="recovery-metric-rate">
      <span className="recovery-metric-percent">{Math.round(metric.rate * 100)}%</span> recovered
      <span className="recovery-metric-counts">
        {' '}
        ({metric.recovered} of {metric.initiallyWrong})
      </span>
    </p>
  );
}

// Compact aggregate only (Slice 6a) - no per-chapter breakdown, deliberately
// deferred until a Dashboard pattern clearly calls for it. Lifetime and
// recent are always shown as two visually distinct blocks, never merged or
// implied to be the same window.
export default function RecoveryMetricsSummary({ lifetime, recent, hasRecentActivity }: RecoveryMetricsSummaryProps) {
  return (
    <div className="recovery-metrics-summary">
      <div className="recovery-metrics-window">
        <h4 className="recovery-metrics-window-title">Lifetime</h4>
        <RecoveryMetricRow metric={lifetime} />
      </div>
      <div className="recovery-metrics-window">
        <h4 className="recovery-metrics-window-title">Last 7 Days</h4>
        {hasRecentActivity ? (
          <RecoveryMetricRow metric={recent} />
        ) : (
          <p className="recovery-metric-empty">No practice in the last 7 days.</p>
        )}
      </div>
    </div>
  );
}
