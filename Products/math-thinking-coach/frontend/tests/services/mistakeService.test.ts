import { afterEach, describe, expect, it, vi } from 'vitest';
import { mistakeService } from '../../src/services/mistakeService';

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

describe('mistakeService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getMyMistakes fetches with credentials included and returns the list unmodified', async () => {
    const mistakes = [
      {
        questionId: 'rn-q01',
        chapterId: 'rational-numbers',
        chapterTitle: 'Rational Numbers',
        topicId: 'topic-rational-numbers-properties-and-operations',
        lastAttemptAt: '2026-09-03T08:00:00.000Z',
      },
    ];
    mockFetchOnce(200, mistakes);

    const result = await mistakeService.getMyMistakes();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/performance/me/mistakes'),
      expect.objectContaining({ credentials: 'include' }),
    );
    // Pass-through only - no field is recomputed or reshaped client-side.
    expect(result).toEqual(mistakes);
  });

  it('getMyMistakes returns an empty list on 401 instead of throwing', async () => {
    mockFetchOnce(401);

    const result = await mistakeService.getMyMistakes();

    expect(result).toEqual([]);
  });

  it('getMyMistakes throws on an unexpected failure', async () => {
    mockFetchOnce(500);

    await expect(mistakeService.getMyMistakes()).rejects.toThrow('Failed to load mistakes');
  });
});
