import type { AttemptActivityRecord } from '../types/activity';

export interface DailyActivityDay {
  date: string; // local calendar date, YYYY-MM-DD
  // Primary metric: distinct questions practiced/attempted that local day -
  // never inflated by retries of the same question.
  questionsAttempted: number;
  // Secondary metric: of those distinct questions, how many were eventually
  // solved correctly that local day (>=1 correct attempt that day) - never
  // presented as the primary signal (see DailyActivityChart.tsx).
  questionsCorrect: number;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, delta: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + delta);
  return result;
}

// Builds a rolling `days`-day timeline (oldest first, ending on `now`'s own
// local calendar day) from raw, un-bucketed attempt records. The backend
// deliberately does no day-grouping at all (Progress Hub V1 timezone
// decision - createdAt is server UTC only) and returns an ~8-day window
// specifically so this function has enough data to construct a correct
// rolling 7-local-day view regardless of the learner's timezone offset; any
// record outside the exact `days`-day local window (the backend's buffer
// day, or anything else) is simply not counted.
//
// Retries of the same question on the same local day are deduplicated to
// one (the "distinct questions practiced" rule); a question counts as
// correct that day if any attempt on it that day was correct - "eventually
// solved correctly", not "most recent attempt correct".
export function buildDailyActivity(
  recentAttempts: AttemptActivityRecord[],
  days = 7,
  now: Date = new Date(),
): DailyActivityDay[] {
  const dayKeys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    dayKeys.push(toLocalDateKey(addDays(now, -offset)));
  }
  const dayKeySet = new Set(dayKeys);

  // local day key -> questionId -> "was any attempt on it that day correct"
  const byDay = new Map<string, Map<string, boolean>>();

  for (const attempt of recentAttempts) {
    const dayKey = toLocalDateKey(new Date(attempt.createdAt));
    if (!dayKeySet.has(dayKey)) {
      continue;
    }

    const questions = byDay.get(dayKey) ?? new Map<string, boolean>();
    const alreadyCorrect = questions.get(attempt.questionId) ?? false;
    questions.set(attempt.questionId, alreadyCorrect || attempt.isCorrect);
    byDay.set(dayKey, questions);
  }

  return dayKeys.map((dayKey) => {
    const questions = byDay.get(dayKey);
    if (!questions) {
      return { date: dayKey, questionsAttempted: 0, questionsCorrect: 0 };
    }
    return {
      date: dayKey,
      questionsAttempted: questions.size,
      questionsCorrect: [...questions.values()].filter(Boolean).length,
    };
  });
}
