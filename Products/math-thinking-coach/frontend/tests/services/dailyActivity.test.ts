import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDailyActivity } from '../../src/services/dailyActivity';

// Fixed, non-DST offset (UTC+5:30) so the UTC-midnight boundary tests below
// are deterministic regardless of the host machine's own timezone.
const originalTZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Asia/Kolkata';
});

afterAll(() => {
  process.env.TZ = originalTZ;
});

describe('buildDailyActivity', () => {
  it('returns 7 zero-filled days, oldest first, ending on "now" local date, when there are no attempts', () => {
    const now = new Date('2026-09-03T10:00:00.000Z'); // 2026-09-03 15:30 IST

    const result = buildDailyActivity([], 7, now);

    expect(result).toHaveLength(7);
    expect(result[0].date).toBe('2026-08-28');
    expect(result[6].date).toBe('2026-09-03');
    expect(result.every((day) => day.questionsAttempted === 0 && day.questionsCorrect === 0)).toBe(true);
  });

  it('deduplicates retries of the same question on the same local day', () => {
    const now = new Date('2026-09-03T10:00:00.000Z');
    const attempts = [
      { questionId: 'q1', chapterId: 'c1', isCorrect: false, createdAt: '2026-09-03T08:00:00.000Z' },
      { questionId: 'q1', chapterId: 'c1', isCorrect: false, createdAt: '2026-09-03T08:05:00.000Z' },
      { questionId: 'q1', chapterId: 'c1', isCorrect: true, createdAt: '2026-09-03T08:10:00.000Z' },
    ];

    const today = buildDailyActivity(attempts, 7, now).find((day) => day.date === '2026-09-03');

    expect(today?.questionsAttempted).toBe(1);
    expect(today?.questionsCorrect).toBe(1); // eventually solved correctly - secondary metric
  });

  it('does not count a question as correct that day if it was never answered correctly that day', () => {
    const now = new Date('2026-09-03T10:00:00.000Z');
    const attempts = [
      { questionId: 'q1', chapterId: 'c1', isCorrect: false, createdAt: '2026-09-03T08:00:00.000Z' },
      { questionId: 'q2', chapterId: 'c1', isCorrect: false, createdAt: '2026-09-03T08:05:00.000Z' },
    ];

    const today = buildDailyActivity(attempts, 7, now).find((day) => day.date === '2026-09-03');

    expect(today?.questionsAttempted).toBe(2);
    expect(today?.questionsCorrect).toBe(0);
  });

  it('counts distinct questions attempted that day independent of correctness', () => {
    const now = new Date('2026-09-03T10:00:00.000Z');
    const attempts = [
      { questionId: 'q1', chapterId: 'c1', isCorrect: true, createdAt: '2026-09-03T08:00:00.000Z' },
      { questionId: 'q2', chapterId: 'c1', isCorrect: false, createdAt: '2026-09-03T08:05:00.000Z' },
      { questionId: 'q3', chapterId: 'c1', isCorrect: false, createdAt: '2026-09-03T08:10:00.000Z' },
    ];

    const today = buildDailyActivity(attempts, 7, now).find((day) => day.date === '2026-09-03');

    expect(today?.questionsAttempted).toBe(3);
    expect(today?.questionsCorrect).toBe(1);
  });

  it('excludes attempts outside the exact rolling window (the backend buffer day and beyond)', () => {
    const now = new Date('2026-09-03T10:00:00.000Z');
    const attempts = [
      // 9 days before "now" - outside even the backend's 8-day buffer.
      { questionId: 'too-old', chapterId: 'c1', isCorrect: true, createdAt: '2026-08-25T08:00:00.000Z' },
    ];

    const result = buildDailyActivity(attempts, 7, now);

    expect(result.reduce((sum, day) => sum + day.questionsAttempted, 0)).toBe(0);
  });

  // The core timezone-decision test: two attempts share the same UTC
  // calendar date (2026-09-02) but fall on different IST calendar dates
  // because of the UTC+5:30 offset crossing local midnight. A naive
  // UTC-calendar-date grouping would put both on 2026-09-02; correct
  // browser-local grouping must split them.
  it('buckets by local calendar day, not UTC calendar day, across the local-midnight boundary', () => {
    const now = new Date('2026-09-03T10:00:00.000Z');
    const attempts = [
      // 2026-09-02T10:00:00Z = 2026-09-02 15:30 IST - stays on Sept 2 locally.
      { questionId: 'stays-sep-2', chapterId: 'c1', isCorrect: true, createdAt: '2026-09-02T10:00:00.000Z' },
      // 2026-09-02T19:00:00Z = 2026-09-03 00:30 IST - already Sept 3 locally,
      // despite being the same UTC calendar date as the row above.
      { questionId: 'rolls-to-sep-3', chapterId: 'c1', isCorrect: true, createdAt: '2026-09-02T19:00:00.000Z' },
    ];

    const result = buildDailyActivity(attempts, 7, now);
    const sep2 = result.find((day) => day.date === '2026-09-02');
    const sep3 = result.find((day) => day.date === '2026-09-03');

    expect(sep2?.questionsAttempted).toBe(1);
    expect(sep3?.questionsAttempted).toBe(1);
  });
});
