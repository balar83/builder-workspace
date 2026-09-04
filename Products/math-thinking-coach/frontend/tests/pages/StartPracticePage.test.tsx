import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Self-Serve Learning Loop V1, Slice 1: proves StartPracticePage honors a
// preselected mode passed via navigation state (the Dashboard's "Practise
// your weak areas" CTA), without bypassing the existing configuration form -
// the learner still lands on the same SessionModeSelector, just starting
// from Revision instead of the generic default.

const mockNavigate = vi.fn();
let mockLocationState: unknown = null;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ chapterId: 'rational-numbers' }),
  useLocation: () => ({ state: mockLocationState }),
}));

vi.mock('../../src/services/authService', () => ({
  authService: { getCurrentUser: vi.fn() },
}));

vi.mock('../../src/services/questionService', () => ({
  questionService: {
    getChapter: vi.fn(),
    getQuestions: vi.fn(),
  },
}));

vi.mock('../../src/services/sessionPointerService', () => ({
  sessionPointerService: { setActiveSession: vi.fn() },
}));

vi.mock('../../src/services/sessionService', () => ({
  sessionService: { createSession: vi.fn() },
}));

import StartPracticePage from '../../src/pages/StartPracticePage';
import { questionService } from '../../src/services/questionService';

const chapter = { id: 'rational-numbers', title: 'Rational Numbers', description: 'D' };

describe('StartPracticePage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockLocationState = null;
  });

  it('defaults to Practice mode when no navigation state is present', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([]);

    render(<StartPracticePage />);

    const practiceRadio = (await screen.findByRole('radio', { name: /Practice/ })) as HTMLInputElement;
    expect(practiceRadio.checked).toBe(true);
  });

  it('preselects Revision mode when the CTA navigated here with presetMode', async () => {
    mockLocationState = { presetMode: 'revision' };
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([]);

    render(<StartPracticePage />);

    const revisionRadio = (await screen.findByRole('radio', { name: /Revision/ })) as HTMLInputElement;
    expect(revisionRadio.checked).toBe(true);
  });
});
