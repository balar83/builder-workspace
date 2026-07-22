import chapters from '../data/chapters';
import questions from '../data/questions';
import type { Chapter } from '../types/chapter';
import type { Question } from '../types/question';

// TODO: Replace with GET /api/v1/chapters
function getChapters(): Chapter[] {
  return chapters;
}

// TODO: Replace with GET /api/v1/chapters/{chapterId}
function getChapter(chapterId: string | undefined): Chapter | undefined {
  return chapters.find((chapter) => chapter.id === chapterId);
}

// TODO: Replace with GET /api/v1/chapters/{chapterId}/questions
function getQuestions(chapterId: string | undefined): Question[] {
  return questions.filter((question) => question.chapterId === chapterId);
}

// TODO: Replace with GET /api/v1/chapters/{chapterId}/questions/{questionId}
function getQuestion(chapterId: string, questionId: string): Question | undefined {
  return questions.find(
    (question) => question.chapterId === chapterId && question.id === questionId,
  );
}

export const questionService = {
  getChapters,
  getChapter,
  getQuestions,
  getQuestion,
};
