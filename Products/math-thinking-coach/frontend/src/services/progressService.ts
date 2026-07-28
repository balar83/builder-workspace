import type { ChapterProgress, StoredProgress } from '../types/progress';
import { progressStore } from './progressStore';

function updateStoredProgress(updater: (data: StoredProgress) => StoredProgress): void {
  const current = progressStore.readProgress();
  progressStore.writeProgress(updater(current));
}

function getOrCreateChapterProgress(data: StoredProgress, chapterId: string): ChapterProgress {
  return (
    data.chapters[chapterId] ?? {
      currentQuestionIndex: 0,
      questionStatus: {},
      lastVisitedAt: new Date().toISOString(),
    }
  );
}

function touchChapter(
  data: StoredProgress,
  chapterId: string,
  change: (chapter: ChapterProgress) => ChapterProgress,
): StoredProgress {
  const chapter = change(getOrCreateChapterProgress(data, chapterId));

  return {
    ...data,
    lastActiveChapterId: chapterId,
    chapters: {
      ...data.chapters,
      [chapterId]: { ...chapter, lastVisitedAt: new Date().toISOString() },
    },
  };
}

function getLastActiveChapter(): string | null {
  return progressStore.readProgress().lastActiveChapterId;
}

function setLastActiveChapter(chapterId: string): void {
  updateStoredProgress((data) => ({ ...data, lastActiveChapterId: chapterId }));
}

function getChapterProgress(chapterId: string): ChapterProgress | undefined {
  return progressStore.readProgress().chapters[chapterId];
}

function getCompletedCount(chapterId: string): number {
  const progress = getChapterProgress(chapterId);
  return progress
    ? Object.values(progress.questionStatus).filter((status) => status === 'completed').length
    : 0;
}

function recordQuestionAttempt(chapterId: string, questionId: string): void {
  updateStoredProgress((data) =>
    touchChapter(data, chapterId, (chapter) => ({
      ...chapter,
      questionStatus: {
        ...chapter.questionStatus,
        [questionId]: chapter.questionStatus[questionId] === 'completed' ? 'completed' : 'attempted',
      },
    })),
  );
}

function recordQuestionCompleted(chapterId: string, questionId: string): void {
  updateStoredProgress((data) =>
    touchChapter(data, chapterId, (chapter) => ({
      ...chapter,
      questionStatus: { ...chapter.questionStatus, [questionId]: 'completed' },
    })),
  );
}

function updateCurrentQuestion(chapterId: string, questionIndex: number): void {
  updateStoredProgress((data) =>
    touchChapter(data, chapterId, (chapter) => ({
      ...chapter,
      currentQuestionIndex: questionIndex,
    })),
  );
}

export const progressService = {
  getLastActiveChapter,
  setLastActiveChapter,
  getChapterProgress,
  getCompletedCount,
  recordQuestionAttempt,
  recordQuestionCompleted,
  updateCurrentQuestion,
};
