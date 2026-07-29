import { afterEach, describe, expect, it } from 'vitest';
import { sessionPointerStore } from '../../src/services/sessionPointerStore';
import type { SessionPointer } from '../../src/types/sessionPointer';

describe('sessionPointerStore', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('readPointer returns null when nothing is stored', () => {
    expect(sessionPointerStore.readPointer()).toBeNull();
  });

  it('writePointer then readPointer round-trips the same data', () => {
    const pointer: SessionPointer = {
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    };

    sessionPointerStore.writePointer(pointer);

    expect(sessionPointerStore.readPointer()).toEqual(pointer);
  });

  it('readPointer returns null when stored JSON is malformed', () => {
    localStorage.setItem('mtc.session-pointer.v1', 'not valid json {');

    expect(sessionPointerStore.readPointer()).toBeNull();
  });

  it('readPointer returns null when the stored shape is missing required fields', () => {
    localStorage.setItem('mtc.session-pointer.v1', JSON.stringify({ studentId: 's1' }));

    expect(sessionPointerStore.readPointer()).toBeNull();
  });

  it('clearPointer removes stored data so a later read returns null', () => {
    sessionPointerStore.writePointer({
      studentId: 's1',
      sessionId: 'session-1',
      chapterId: 'linear-equations',
      mode: 'practice',
    });

    sessionPointerStore.clearPointer();

    expect(sessionPointerStore.readPointer()).toBeNull();
  });
});
