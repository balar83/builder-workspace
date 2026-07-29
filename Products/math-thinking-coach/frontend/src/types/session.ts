import type { Difficulty } from './question';

export type SessionMode = 'practice' | 'test' | 'revision';
export type RequestedDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';
export type SessionStatus = 'not_started' | 'in_progress' | 'completed' | 'expired' | 'abandoned';

// questionTypes is deliberately omitted - the backend accepts it but
// QuestionCandidate.type is always null today (ADR-006), so filtering by
// question type is a documented no-op with no UI control for it.
export interface CreateSessionRequest {
  chapterId: string;
  mode: SessionMode;
  difficulty?: RequestedDifficulty;
  questionCount?: number;
  timeLimitMinutes?: number;
}

export interface CreateSessionResponse {
  sessionId: string;
  targetCount: number;
  actualCount: number;
  shortfall: boolean;
}

export interface QuestionContent {
  id: string;
  question: string;
  text: string;
  difficulty: Difficulty;
  hints: string[];
  solution: string;
}

export interface CurrentQuestionResponse {
  position: number;
  totalCount: number;
  question: QuestionContent;
}

export interface SessionTerminalResponse {
  sessionId: string;
  status: SessionStatus;
  position: number;
  totalCount: number;
  correctCount: number;
}

// Discriminates the three real outcomes of GET current-question - a live
// question, a terminal session (409, body already carries the summary), or
// an unknown/not-owned session (404) - so callers never have to guess which
// case a response represents.
export type CurrentQuestionResult =
  | { type: 'question'; question: CurrentQuestionResponse }
  | { type: 'terminal'; terminal: SessionTerminalResponse }
  | { type: 'not-found' };
