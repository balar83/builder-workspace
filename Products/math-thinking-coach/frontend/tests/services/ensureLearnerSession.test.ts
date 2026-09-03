import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    startLearner: vi.fn(),
  },
}));

import { ensureLearnerSession } from '../../src/services/ensureLearnerSession';
import { authService } from '../../src/services/authService';

describe('ensureLearnerSession', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls startLearner when no current user exists', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue(undefined);
    vi.mocked(authService.startLearner).mockResolvedValue({
      role: 'student',
      id: 'learner_abc',
      name: null,
    });

    await ensureLearnerSession();

    expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(authService.startLearner).toHaveBeenCalledTimes(1);
  });

  it('does not call startLearner when a self-serve learner session already exists', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      role: 'student',
      id: 'learner_existing',
      name: null,
    });

    await ensureLearnerSession();

    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('does not call startLearner when a class-connected student session already exists', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      role: 'student',
      id: 'existing-student-id',
      name: 'Asha',
    });

    await ensureLearnerSession();

    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('does not call startLearner when a teacher session already exists', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      role: 'teacher',
      id: 'teacher-1',
      name: 'Ms. Rao',
    });

    await ensureLearnerSession();

    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('checks identity before creating one, never concurrently', async () => {
    const callOrder: string[] = [];
    vi.mocked(authService.getCurrentUser).mockImplementation(async () => {
      callOrder.push('getCurrentUser');
      return undefined;
    });
    vi.mocked(authService.startLearner).mockImplementation(async () => {
      callOrder.push('startLearner');
      return { role: 'student', id: 'learner_abc', name: null };
    });

    await ensureLearnerSession();

    expect(callOrder).toEqual(['getCurrentUser', 'startLearner']);
  });
});
