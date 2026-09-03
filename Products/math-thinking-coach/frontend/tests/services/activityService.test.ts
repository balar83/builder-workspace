import { afterEach, describe, expect, it, vi } from 'vitest';
import { activityService } from '../../src/services/activityService';

function mockFetchOnce(status: number, body?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

describe('activityService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getMyActivity fetches with credentials included and returns the response', async () => {
    const activity = {
      recentAttempts: [
        { questionId: 'rn-q01', chapterId: 'rational-numbers', isCorrect: true, createdAt: '2026-09-03T08:00:00.000Z' },
      ],
      chapterActivity: [
        {
          chapterId: 'rational-numbers',
          chapterTitle: 'Rational Numbers',
          questionsAttempted: 1,
          questionsCorrect: 1,
          accuracy: 1,
          lastActivityAt: '2026-09-03T08:00:00.000Z',
        },
      ],
    };
    mockFetchOnce(200, activity);

    const result = await activityService.getMyActivity();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/performance/me/activity'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual(activity);
  });

  it('getMyActivity returns an empty shape on 401 instead of throwing', async () => {
    mockFetchOnce(401);

    const result = await activityService.getMyActivity();

    expect(result).toEqual({ recentAttempts: [], chapterActivity: [] });
  });

  it('getMyActivity throws on an unexpected failure', async () => {
    mockFetchOnce(500);

    await expect(activityService.getMyActivity()).rejects.toThrow('Failed to load activity');
  });
});
