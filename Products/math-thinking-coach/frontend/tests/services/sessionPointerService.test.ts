import { afterEach, describe, expect, it } from 'vitest';
import { sessionPointerService } from '../../src/services/sessionPointerService';

describe('sessionPointerService', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('getActiveSessionFor returns undefined when nothing has been recorded', () => {
    expect(sessionPointerService.getActiveSessionFor('s1')).toBeUndefined();
  });

  it('setActiveSession makes it visible to getActiveSessionFor for the same student', () => {
    sessionPointerService.setActiveSession({
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    });

    expect(sessionPointerService.getActiveSessionFor('s1')).toEqual({
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    });
  });

  it('getActiveSessionFor returns undefined for a different student - a shared-device safety check', () => {
    sessionPointerService.setActiveSession({
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    });

    expect(sessionPointerService.getActiveSessionFor('s2')).toBeUndefined();
  });

  it('clearActiveSession removes the pointer unconditionally', () => {
    sessionPointerService.setActiveSession({
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    });

    sessionPointerService.clearActiveSession();

    expect(sessionPointerService.getActiveSessionFor('s1')).toBeUndefined();
  });

  it('clearActiveSessionIfMatches clears the pointer when the session id matches', () => {
    sessionPointerService.setActiveSession({
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    });

    sessionPointerService.clearActiveSessionIfMatches('session-1');

    expect(sessionPointerService.getActiveSessionFor('s1')).toBeUndefined();
  });

  it('clearActiveSessionIfMatches leaves a different session pointer untouched', () => {
    sessionPointerService.setActiveSession({
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    });

    sessionPointerService.clearActiveSessionIfMatches('some-other-session');

    expect(sessionPointerService.getActiveSessionFor('s1')).toEqual({
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    });
  });
});
