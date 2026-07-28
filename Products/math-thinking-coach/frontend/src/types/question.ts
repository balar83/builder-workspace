export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Question {
  id: string;
  chapterId: string;
  question: string;
  text: string;
  difficulty: Difficulty;
  hints: string[];
  solution: string;
  topicId?: string | null;
}

