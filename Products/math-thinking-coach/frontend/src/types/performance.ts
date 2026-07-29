export interface TopicPerformance {
  topicId: string;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  currentStreak: number;
  mastered: boolean;
}
