import { afterEach, describe, expect, it, vi } from 'vitest';
import { performanceService } from '../../src/services/performanceService';

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

describe('performanceService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getMyPerformance fetches with credentials included and returns the list', async () => {
    const performance = [
      { topicId: 'linear-equations', questionsAttempted: 4, questionsCorrect: 3, accuracy: 0.75, currentStreak: 2, mastered: false },
    ];
    mockFetchOnce(200, performance);

    const result = await performanceService.getMyPerformance();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/performance/me'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual(performance);
  });

  it('getMyPerformance returns an empty list on 401 instead of throwing', async () => {
    mockFetchOnce(401);

    const result = await performanceService.getMyPerformance();

    expect(result).toEqual([]);
  });

  it('getMyPerformance throws on an unexpected failure', async () => {
    mockFetchOnce(500);

    await expect(performanceService.getMyPerformance()).rejects.toThrow('Failed to load performance');
  });
});
