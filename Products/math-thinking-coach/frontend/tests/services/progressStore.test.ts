import { afterEach, describe, expect, it } from 'vitest';
import { progressStore } from '../../src/services/progressStore';
import type { StoredProgress } from '../../src/types/progress';

describe('progressStore', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('readProgress returns an empty default when nothing is stored', () => {
    const result = progressStore.readProgress();

    expect(result).toEqual({
      schemaVersion: 1,
      lastActiveChapterId: null,
      chapters: {},
    });
  });

  it('writeProgress then readProgress round-trips the same data', () => {
    const data: StoredProgress = {
      schemaVersion: 1,
      lastActiveChapterId: 'rational-numbers',
      chapters: {
        'rational-numbers': {
          currentQuestionIndex: 2,
          questionStatus: { 'q1-rational-numbers': 'completed' },
          lastVisitedAt: '2026-07-24T10:00:00.000Z',
        },
      },
    };

    progressStore.writeProgress(data);
    const result = progressStore.readProgress();

    expect(result).toEqual(data);
  });

  it('readProgress returns an empty default when stored JSON is malformed', () => {
    localStorage.setItem('mtc.progress.v1', 'not valid json {');

    const result = progressStore.readProgress();

    expect(result).toEqual({
      schemaVersion: 1,
      lastActiveChapterId: null,
      chapters: {},
    });
  });

  it('readProgress returns an empty default when the schema version does not match', () => {
    localStorage.setItem(
      'mtc.progress.v1',
      JSON.stringify({ schemaVersion: 99, lastActiveChapterId: null, chapters: {} }),
    );

    const result = progressStore.readProgress();

    expect(result).toEqual({
      schemaVersion: 1,
      lastActiveChapterId: null,
      chapters: {},
    });
  });

  it('readProgress returns an empty default when chapters is missing or the wrong shape', () => {
    localStorage.setItem(
      'mtc.progress.v1',
      JSON.stringify({ schemaVersion: 1, lastActiveChapterId: null }),
    );

    const result = progressStore.readProgress();

    expect(result).toEqual({
      schemaVersion: 1,
      lastActiveChapterId: null,
      chapters: {},
    });
  });

  it('clearProgress removes stored data so a later read returns the empty default', () => {
    progressStore.writeProgress({
      schemaVersion: 1,
      lastActiveChapterId: 'rational-numbers',
      chapters: {},
    });

    progressStore.clearProgress();
    const result = progressStore.readProgress();

    expect(result).toEqual({
      schemaVersion: 1,
      lastActiveChapterId: null,
      chapters: {},
    });
  });
});
