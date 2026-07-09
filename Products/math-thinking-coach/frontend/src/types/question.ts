export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Question {
  id: string;
  chapterId: string;
  text: string;
  difficulty: Difficulty;
  hints: string[];
}

