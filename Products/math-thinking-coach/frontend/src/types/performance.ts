export interface TopicPerformance {
  topicId: string;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  currentStreak: number;
  mastered: boolean;
}

// D1: read-time aggregate only, no persistence, no mastery semantics. Means
// "recent accuracy on questions covering this idea" - a concept absent from
// the response has zero attempts and must render as "not yet attempted",
// never 0%. See backend/app/services/concept_performance_service.py.
export interface ConceptPerformance {
  conceptId: string;
  conceptTitle: string;
  topicId: string;
  chapterId: string;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
}
