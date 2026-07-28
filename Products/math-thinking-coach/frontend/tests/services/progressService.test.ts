import { afterEach, describe, expect, it } from 'vitest';
import { progressService } from '../../src/services/progressService';

describe('progressService', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('getLastActiveChapter returns null when nothing has been recorded', () => {
    expect(progressService.getLastActiveChapter()).toBeNull();
  });

  it('setLastActiveChapter makes it visible to getLastActiveChapter', () => {
    progressService.setLastActiveChapter('rational-numbers');

    expect(progressService.getLastActiveChapter()).toBe('rational-numbers');
  });

  it('getChapterProgress returns undefined for a chapter with no recorded progress', () => {
    expect(progressService.getChapterProgress('rational-numbers')).toBeUndefined();
  });

  it('recordQuestionAttempt creates chapter progress and marks the chapter as last active', () => {
    progressService.recordQuestionAttempt('rational-numbers', 'q1-rational-numbers');

    const progress = progressService.getChapterProgress('rational-numbers');
    expect(progress?.questionStatus).toEqual({ 'q1-rational-numbers': 'attempted' });
    expect(progressService.getLastActiveChapter()).toBe('rational-numbers');
  });

  it('recordQuestionAttempt does not downgrade a completed question back to attempted', () => {
    progressService.recordQuestionCompleted('rational-numbers', 'q1-rational-numbers');
    progressService.recordQuestionAttempt('rational-numbers', 'q1-rational-numbers');

    const progress = progressService.getChapterProgress('rational-numbers');
    expect(progress?.questionStatus['q1-rational-numbers']).toBe('completed');
  });

  it('recordQuestionCompleted marks a question completed, upgrading from attempted', () => {
    progressService.recordQuestionAttempt('rational-numbers', 'q1-rational-numbers');
    progressService.recordQuestionCompleted('rational-numbers', 'q1-rational-numbers');

    const progress = progressService.getChapterProgress('rational-numbers');
    expect(progress?.questionStatus['q1-rational-numbers']).toBe('completed');
  });

  it('updateCurrentQuestion sets the current question index and marks the chapter as last active', () => {
    progressService.updateCurrentQuestion('rational-numbers', 3);

    const progress = progressService.getChapterProgress('rational-numbers');
    expect(progress?.currentQuestionIndex).toBe(3);
    expect(progressService.getLastActiveChapter()).toBe('rational-numbers');
  });

  it('getCompletedCount returns 0 for a chapter with no recorded progress', () => {
    expect(progressService.getCompletedCount('rational-numbers')).toBe(0);
  });

  it('getCompletedCount counts only completed questions, not attempted ones', () => {
    progressService.recordQuestionAttempt('rational-numbers', 'q1-rational-numbers');
    progressService.recordQuestionCompleted('rational-numbers', 'q2-rational-numbers');
    progressService.recordQuestionCompleted('rational-numbers', 'q3-rational-numbers');

    expect(progressService.getCompletedCount('rational-numbers')).toBe(2);
  });

  it('tracks progress for multiple chapters independently', () => {
    progressService.recordQuestionAttempt('rational-numbers', 'q1-rational-numbers');
    progressService.recordQuestionCompleted('linear-equations', 'q1-linear-equations');

    expect(progressService.getChapterProgress('rational-numbers')?.questionStatus).toEqual({
      'q1-rational-numbers': 'attempted',
    });
    expect(progressService.getChapterProgress('linear-equations')?.questionStatus).toEqual({
      'q1-linear-equations': 'completed',
    });
    expect(progressService.getLastActiveChapter()).toBe('linear-equations');
  });
});
