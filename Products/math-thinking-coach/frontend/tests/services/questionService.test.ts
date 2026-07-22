import { afterEach, describe, expect, it, vi } from 'vitest';
import { questionService } from '../../src/services/questionService';

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

describe('questionService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getChapters fetches the chapters endpoint', async () => {
    const chapters = [{ id: 'c1', title: 'T', description: 'D' }];
    mockFetchOnce(200, chapters);

    const result = await questionService.getChapters();

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/chapters'));
    expect(result).toEqual(chapters);
  });

  it('getChapter fetches a single chapter by id', async () => {
    const chapter = { id: 'c1', title: 'T', description: 'D' };
    mockFetchOnce(200, chapter);

    const result = await questionService.getChapter('c1');

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/chapters/c1'));
    expect(result).toEqual(chapter);
  });

  it('getChapter returns undefined for a 404 response', async () => {
    mockFetchOnce(404);

    const result = await questionService.getChapter('missing');

    expect(result).toBeUndefined();
  });

  it('getChapter returns undefined without calling fetch when chapterId is undefined', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const result = await questionService.getChapter(undefined);

    expect(result).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('getQuestions fetches questions for a chapter', async () => {
    const questions = [{ id: 'q1', chapterId: 'c1' }];
    mockFetchOnce(200, questions);

    const result = await questionService.getQuestions('c1');

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/chapters/c1/questions'));
    expect(result).toEqual(questions);
  });

  it('getQuestions returns an empty array for a 404 response', async () => {
    mockFetchOnce(404);

    const result = await questionService.getQuestions('missing');

    expect(result).toEqual([]);
  });

  it('getQuestion fetches a single question by id', async () => {
    const question = { id: 'q1', chapterId: 'c1' };
    mockFetchOnce(200, question);

    const result = await questionService.getQuestion('c1', 'q1');

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/chapters/c1/questions/q1'));
    expect(result).toEqual(question);
  });

  it('getQuestion returns undefined for a 404 response', async () => {
    mockFetchOnce(404);

    const result = await questionService.getQuestion('c1', 'missing');

    expect(result).toBeUndefined();
  });

  it('submitAnswer posts the submission and returns the typed evaluation', async () => {
    const evaluation = {
      evaluation: { isCorrect: true, score: 1.0 },
      coach: { message: 'Excellent! You solved it correctly.', nextAction: 'NEXT_QUESTION' },
      ui: { canTryAgain: false, canRevealSolution: false, hintLevel: 0 },
    };
    mockFetchOnce(200, evaluation);

    const result = await questionService.submitAnswer('q1', { answer: '1/2', attemptNumber: 1 });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/questions/q1/answer'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission: { answer: '1/2', attemptNumber: 1 } }),
      }),
    );
    expect(result).toEqual(evaluation);
  });

  it('submitAnswer throws when the request fails', async () => {
    mockFetchOnce(500);

    await expect(questionService.submitAnswer('q1', { answer: '1/2', attemptNumber: 1 })).rejects.toThrow();
  });
});
