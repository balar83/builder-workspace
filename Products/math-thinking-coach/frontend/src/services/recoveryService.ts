import { API_BASE_URL } from '../config/api';
import type { AccuracyMetric, EvidenceWindowMetrics, RecoveryMetric, RecoveryMetricsResponse } from '../types/recovery';

const EMPTY_ACCURACY_METRIC: AccuracyMetric = { correct: 0, attempted: 0, accuracy: null };
const EMPTY_RECOVERY_METRIC: RecoveryMetric = { recovered: 0, initiallyWrong: 0, rate: null, sufficientSample: false };
const EMPTY_WINDOW_METRICS: EvidenceWindowMetrics = {
  firstAttemptAccuracy: EMPTY_ACCURACY_METRIC,
  eventualAccuracy: EMPTY_ACCURACY_METRIC,
  recovery: EMPTY_RECOVERY_METRIC,
};

async function getMyRecoveryMetrics(): Promise<RecoveryMetricsResponse> {
  const response = await fetch(`${API_BASE_URL}/performance/me/recovery`, {
    credentials: 'include',
  });

  // Same no-session-is-not-an-error handling as performanceService.ts/
  // activityService.ts - RequireStudent owns redirecting unauthenticated
  // visitors away from Dashboard; a page that does render should just show
  // no evidence yet. The fallback shape is exactly what the backend itself
  // returns for a learner with zero recorded attempts (every window honestly
  // empty, no fabricated evidence), not an arbitrary placeholder.
  if (response.status === 401) {
    return { lifetime: EMPTY_WINDOW_METRICS, recent: EMPTY_WINDOW_METRICS, hasRecentActivity: false, chapters: [] };
  }
  if (!response.ok) {
    throw new Error('Failed to load recovery metrics');
  }
  return response.json();
}

export const recoveryService = {
  getMyRecoveryMetrics,
};
