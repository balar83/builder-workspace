// Mirrors backend/app/schemas/performance.py's recovery metric shapes
// exactly (Self-Serve Learning Loop V1, Slice 4/6a). All values are
// computed server-side and rendered as-is - the frontend never recomputes
// accuracy, recovery rate, or sample-sufficiency thresholds.

// correct/attempted are always present (0 when there's no evidence);
// accuracy is null whenever attempted === 0 - never a fabricated 0%.
export interface AccuracyMetric {
  correct: number;
  attempted: number;
  accuracy: number | null;
}

// rate is null below the backend's minimum sample size (including the
// genuinely-zero case) - sufficientSample says so explicitly so a UI never
// has to infer "not enough evidence" from a null rate alone.
export interface RecoveryMetric {
  recovered: number;
  initiallyWrong: number;
  rate: number | null;
  sufficientSample: boolean;
}

export interface EvidenceWindowMetrics {
  firstAttemptAccuracy: AccuracyMetric;
  eventualAccuracy: AccuracyMetric;
  recovery: RecoveryMetric;
}

export interface ChapterRecoveryMetrics {
  chapterId: string;
  chapterTitle: string;
  lifetime: EvidenceWindowMetrics;
  recent: EvidenceWindowMetrics;
  hasRecentActivity: boolean;
}

// GET /performance/me/recovery's response. `recent` must never be treated
// as current when hasRecentActivity is false - every recent sub-metric
// still honestly reports attempted=0/accuracy=null/rate=null in that case,
// but hasRecentActivity is the explicit, un-inferred signal for it.
export interface RecoveryMetricsResponse {
  lifetime: EvidenceWindowMetrics;
  recent: EvidenceWindowMetrics;
  hasRecentActivity: boolean;
  chapters: ChapterRecoveryMetrics[];
}
