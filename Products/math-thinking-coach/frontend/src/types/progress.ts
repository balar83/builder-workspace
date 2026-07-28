export type QuestionStatus = 'attempted' | 'completed';

export interface ChapterProgress {
  currentQuestionIndex: number;
  questionStatus: Record<string, QuestionStatus>;
  lastVisitedAt: string;
}

export interface StoredProgress {
  schemaVersion: number;
  lastActiveChapterId: string | null;
  chapters: Record<string, ChapterProgress>;
}
