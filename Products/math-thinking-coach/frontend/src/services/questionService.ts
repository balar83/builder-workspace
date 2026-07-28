import { API_BASE_URL } from '../config/api';
import type { AnswerEvaluationResponse, AnswerSubmission } from '../types/answer';
import type { Chapter } from '../types/chapter';
import type { Question } from '../types/question';
import type { Topic } from '../types/topic';

async function getChapters(): Promise<Chapter[]> {
  const response = await fetch(`${API_BASE_URL}/chapters`);
  if (!response.ok) {
    throw new Error('Failed to load chapters');
  }
  return response.json();
}

async function getChapter(chapterId: string | undefined): Promise<Chapter | undefined> {
  if (!chapterId) {
    return undefined;
  }

  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}`);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error('Failed to load chapter');
  }
  return response.json();
}

async function getQuestions(chapterId: string | undefined): Promise<Question[]> {
  if (!chapterId) {
    return [];
  }

  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}/questions`);
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error('Failed to load questions');
  }
  return response.json();
}

async function getQuestion(
  chapterId: string,
  questionId: string,
): Promise<Question | undefined> {
  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}/questions/${questionId}`);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error('Failed to load question');
  }
  return response.json();
}

async function submitAnswer(
  questionId: string,
  submission: AnswerSubmission,
): Promise<AnswerEvaluationResponse> {
  const response = await fetch(`${API_BASE_URL}/questions/${questionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submission }),
  });
  if (!response.ok) {
    throw new Error('Failed to submit answer');
  }
  return response.json();
}

async function getTopics(chapterId: string | undefined): Promise<Topic[]> {
  if (!chapterId) {
    return [];
  }

  const response = await fetch(`${API_BASE_URL}/chapters/${chapterId}/topics`);
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error('Failed to load topics');
  }
  return response.json();
}

async function getTopic(topicId: string | undefined): Promise<Topic | undefined> {
  if (!topicId) {
    return undefined;
  }

  const response = await fetch(`${API_BASE_URL}/topics/${topicId}`);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error('Failed to load topic');
  }
  return response.json();
}

export const questionService = {
  getChapters,
  getChapter,
  getQuestions,
  getQuestion,
  getTopics,
  getTopic,
  submitAnswer,
};
