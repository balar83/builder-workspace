import { API_BASE_URL } from '../config/api';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  CurrentQuestionResult,
  SessionTerminalResponse,
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

export const sessionService = {
  createSession,
  getCurrentQuestion,
};
