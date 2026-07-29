import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionService } from '../../src/services/sessionService';

function mockFetchOnce(status: number, body?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

describe('sessionService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createSession posts the request with credentials included and returns the response', async () => {
    const response = { sessionId: 's1', targetCount: 10, actualCount: 10, shortfall: false };
    mockFetchOnce(200, response);

    const result = await sessionService.createSession({ chapterId: 'linear-equations', mode: 'practice' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sessions'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ chapterId: 'linear-equations', mode: 'practice' }),
      }),
    );
    expect(result).toEqual(response);
  });

  it('createSession throws the backend detail message on a 400 (e.g. zero selectable questions)', async () => {
    mockFetchOnce(400, { detail: 'No questions available for chapter matching the requested configuration' });

    await expect(
      sessionService.createSession({ chapterId: 'linear-equations', mode: 'practice' }),
    ).rejects.toThrow('No questions available for chapter matching the requested configuration');
  });

  it('getCurrentQuestion returns a question result on 200', async () => {
    const body = { position: 0, totalCount: 5, question: { id: 'q1', question: 'Q', text: 'Q', difficulty: 'Easy', hints: [], solution: 'S' } };
    mockFetchOnce(200, body);

    const result = await sessionService.getCurrentQuestion('s1');

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/sessions/s1/current-question'), expect.objectContaining({ credentials: 'include' }));
    expect(result).toEqual({ type: 'question', question: body });
  });

  it('getCurrentQuestion returns a terminal result on 409, using the response body', async () => {
    const terminal = { sessionId: 's1', status: 'completed', position: 5, totalCount: 5, correctCount: 4 };
    mockFetchOnce(409, { detail: terminal });

    const result = await sessionService.getCurrentQuestion('s1');

    expect(result).toEqual({ type: 'terminal', terminal });
  });

  it('getCurrentQuestion returns a not-found result on 404', async () => {
    mockFetchOnce(404, { detail: 'Session s1 not found' });

    const result = await sessionService.getCurrentQuestion('s1');

    expect(result).toEqual({ type: 'not-found' });
  });

  it('getCurrentQuestion throws on an unexpected failure', async () => {
    mockFetchOnce(500);

    await expect(sessionService.getCurrentQuestion('s1')).rejects.toThrow('Failed to load the current question');
  });

  it('submitSessionAnswer posts exactly {position, answer} - never an attemptNumber', async () => {
    const response = {
      evaluation: { isCorrect: true, score: 1 },
      coach: { message: 'Excellent!', nextAction: 'NEXT_QUESTION' },
      ui: { canTryAgain: false, canRevealSolution: false, hintLevel: 0 },
      position: 1,
      totalCount: 5,
      sessionStatus: 'in_progress',
    };
    mockFetchOnce(200, response);

    const result = await sessionService.submitSessionAnswer('s1', { position: 0, answer: '42' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sessions/s1/answer'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ position: 0, answer: '42' }),
      }),
    );
    expect(result).toEqual({ type: 'ok', response });
  });

  it('submitSessionAnswer returns a stale result on 409 (position mismatch or already terminal)', async () => {
    mockFetchOnce(409, { detail: 'Position 0 does not match the session current position 1' });

    const result = await sessionService.submitSessionAnswer('s1', { position: 0, answer: '42' });

    expect(result).toEqual({ type: 'stale' });
  });

  it('submitSessionAnswer returns a not-found result on 404', async () => {
    mockFetchOnce(404, { detail: 'Session s1 not found' });

    const result = await sessionService.submitSessionAnswer('s1', { position: 0, answer: '42' });

    expect(result).toEqual({ type: 'not-found' });
  });

  it('submitSessionAnswer throws on an unexpected failure', async () => {
    mockFetchOnce(500);

    await expect(sessionService.submitSessionAnswer('s1', { position: 0, answer: '42' })).rejects.toThrow(
      'Failed to submit your answer',
    );
  });

  it('getSessionSummary returns the summary on 200', async () => {
    const summary = {
      sessionId: 's1',
      mode: 'test',
      status: 'completed',
      position: 5,
      totalCount: 5,
      correctCount: 4,
      startedAt: '2026-07-29T10:00:00.000Z',
      completedAt: '2026-07-29T10:10:00.000Z',
    };
    mockFetchOnce(200, summary);

    const result = await sessionService.getSessionSummary('s1');

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/sessions/s1'), expect.objectContaining({ credentials: 'include' }));
    expect(result).toEqual({ type: 'ok', summary });
  });

  it('getSessionSummary returns a not-found result on 404', async () => {
    mockFetchOnce(404, { detail: 'Session s1 not found' });

    const result = await sessionService.getSessionSummary('s1');

    expect(result).toEqual({ type: 'not-found' });
  });

  it('getSessionSummary throws on an unexpected failure', async () => {
    mockFetchOnce(500);

    await expect(sessionService.getSessionSummary('s1')).rejects.toThrow('Failed to load the session summary');
  });
});
