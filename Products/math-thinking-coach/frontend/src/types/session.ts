import type { AnswerCoach, AnswerEvaluation, AnswerUiState } from './answer';
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

// No attemptNumber field, deliberately - ADR-007's invariant is that the
// server always derives it (SessionState.attemptsOnCurrentQuestion + 1);
// a client-supplied value is not part of this contract at all.
export interface SubmitSessionAnswerRequest {
  position: number;
  answer: string;
}

export interface SubmitSessionAnswerResponse {
  evaluation: AnswerEvaluation;
  coach: AnswerCoach;
  ui: AnswerUiState;
  position: number;
  totalCount: number;
  sessionStatus: SessionStatus;
}

// POST /answer's 409 covers two distinct backend cases (stale position,
// already-terminal session) with the same plain-string error body - both
// recover identically on the client (re-fetch current-question and let
// *that* response's own type distinguish stale-but-live from truly
// terminal), so both collapse into one 'stale' case here.
export type SubmitAnswerResult =
  | { type: 'ok'; response: SubmitSessionAnswerResponse }
  | { type: 'stale' }
  | { type: 'not-found' };

export interface SessionSummaryResponse {
  sessionId: string;
  mode: SessionMode;
  status: SessionStatus;
  position: number;
  totalCount: number;
  correctCount: number;
  startedAt: string | null;
  completedAt: string | null;
  // RC1 polish: only ever set for Test mode - the field a countdown timer
  // is derived from, combined with startedAt.
  timeLimitMinutes: number | null;
}

// 'not-found' is a real, expected outcome here (a resume pointer whose
// session no longer exists) - not just an error case to throw past.
export type SessionSummaryResult =
  | { type: 'ok'; summary: SessionSummaryResponse }
  | { type: 'not-found' };
