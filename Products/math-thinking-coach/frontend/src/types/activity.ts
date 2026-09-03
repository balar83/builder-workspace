// Mirrors backend/app/schemas/performance.py's AttemptActivityRecord.
// createdAt is preserved exactly as the server stored it (UTC ISO) - all
// local-day bucketing happens client-side (Progress Hub V1 timezone
// decision), never on the backend. See services/dailyActivity.ts.
export interface AttemptActivityRecord {
  questionId: string;
  chapterId: string;
  isCorrect: boolean;
  createdAt: string;
}

// Mirrors backend's ChapterActivity. Lifetime-scoped, chapter-keyed (not
// topic-keyed). Every curriculum chapter is always present - including one
// with no Topic (Practical Geometry) and any chapter with zero recorded
// attempts (curriculum-coverage visibility, approved V1 UX decision) -
// never omitted for having no activity. questionsAttempted/Correct are
// distinct-question counts - "correct" means "eventually solved correctly"
// (>=1 correct attempt), not "most recent attempt correct."
export interface ChapterActivity {
  chapterId: string;
  chapterTitle: string;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  // null for a chapter with no recorded attempts.
  lastActivityAt: string | null;
}

export interface ActivityResponse {
  recentAttempts: AttemptActivityRecord[];
  chapterActivity: ChapterActivity[];
}
