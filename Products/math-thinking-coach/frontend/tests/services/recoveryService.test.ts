import { afterEach, describe, expect, it, vi } from 'vitest';
import { recoveryService } from '../../src/services/recoveryService';

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

describe('recoveryService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getMyRecoveryMetrics fetches with credentials included and returns the response unmodified', async () => {
    const recoveryMetric = { recovered: 2, initiallyWrong: 4, rate: 0.5, sufficientSample: true };
    const accuracyMetric = { correct: 3, attempted: 5, accuracy: 0.6 };
    const windowMetrics = {
      firstAttemptAccuracy: accuracyMetric,
      eventualAccuracy: accuracyMetric,
      recovery: recoveryMetric,
    };
    const response = {
      lifetime: windowMetrics,
      recent: windowMetrics,
      hasRecentActivity: true,
      chapters: [
        {
          chapterId: 'rational-numbers',
          chapterTitle: 'Rational Numbers',
          lifetime: windowMetrics,
          recent: windowMetrics,
          hasRecentActivity: true,
        },
      ],
    };
    mockFetchOnce(200, response);

    const result = await recoveryService.getMyRecoveryMetrics();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/performance/me/recovery'),
      expect.objectContaining({ credentials: 'include' }),
    );
    // Pass-through only - no field is recomputed or reshaped client-side.
    expect(result).toEqual(response);
  });

  it('getMyRecoveryMetrics returns an honest zero-evidence shape on 401 instead of throwing', async () => {
    mockFetchOnce(401);

    const result = await recoveryService.getMyRecoveryMetrics();

    const emptyAccuracy = { correct: 0, attempted: 0, accuracy: null };
    const emptyRecovery = { recovered: 0, initiallyWrong: 0, rate: null, sufficientSample: false };
    const emptyWindow = { firstAttemptAccuracy: emptyAccuracy, eventualAccuracy: emptyAccuracy, recovery: emptyRecovery };
    expect(result).toEqual({
      lifetime: emptyWindow,
      recent: emptyWindow,
      hasRecentActivity: false,
      chapters: [],
    });
  });

  it('getMyRecoveryMetrics throws on an unexpected failure', async () => {
    mockFetchOnce(500);

    await expect(recoveryService.getMyRecoveryMetrics()).rejects.toThrow('Failed to load recovery metrics');
  });
});
