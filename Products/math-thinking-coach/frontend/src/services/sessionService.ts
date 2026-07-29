import { API_BASE_URL } from '../config/api';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  CurrentQuestionResult,
  SessionSummaryResult,
  SessionTerminalResponse,
  SubmitAnswerResult,
  SubmitSessionAnswerRequest,
} from '../types/session';

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.detail === 'string' ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

async function createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create session'));
  }
  return response.json();
}

async function getCurrentQuestion(sessionId: string): Promise<CurrentQuestionResult> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/current-question`, {
    credentials: 'include',
  });

  // 409 means the session is terminal - the response body is already a
  // full SessionTerminalResponse (ADR-007), not an error to re-fetch past.
  if (response.status === 409) {
    const body = await response.json();
    return { type: 'terminal', terminal: body.detail as SessionTerminalResponse };
  }
  if (response.status === 404) {
    return { type: 'not-found' };
  }
  if (!response.ok) {
    throw new Error('Failed to load the current question');
  }

  return { type: 'question', question: await response.json() };
}

async function submitSessionAnswer(
  sessionId: string,
  request: SubmitSessionAnswerRequest,
): Promise<SubmitAnswerResult> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/answer`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  // Covers both the stale-position and already-terminal cases (ADR-007) -
  // the caller recovers from both identically, by re-fetching current-question.
  if (response.status === 409) {
    return { type: 'stale' };
  }
  if (response.status === 404) {
    return { type: 'not-found' };
  }
  if (!response.ok) {
    throw new Error('Failed to submit your answer');
  }

  return { type: 'ok', response: await response.json() };
}

async function getSessionSummary(sessionId: string): Promise<SessionSummaryResult> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    credentials: 'include',
  });

  // 'not-found' is a real outcome to handle, not just an error - a resume
  // pointer whose session no longer exists is exactly this case.
  if (response.status === 404) {
    return { type: 'not-found' };
  }
  if (!response.ok) {
    throw new Error('Failed to load the session summary');
  }

  return { type: 'ok', summary: await response.json() };
}

export const sessionService = {
  createSession,
  getCurrentQuestion,
  submitSessionAnswer,
  getSessionSummary,
};
