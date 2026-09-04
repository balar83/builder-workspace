// Mirrors backend/app/schemas/performance.py's UnresolvedMistake exactly
// (Self-Serve Learning Loop V1, Slice 6b). "Unresolved" is entirely a
// backend semantic - a question whose latest attempt was wrong, with any
// later correct attempt removing it from this list - never recomputed
// client-side.
export interface UnresolvedMistake {
  questionId: string;
  chapterId: string;
  chapterTitle: string;
  topicId: string | null;
  lastAttemptAt: string;
}
