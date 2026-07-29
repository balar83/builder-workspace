import type { SessionPointer } from '../types/sessionPointer';

// Deliberately a separate key from Release 0.1's mtc.progress.v1 - must
// never collide with, or be read/written by, the same code path.
const STORAGE_KEY = 'mtc.session-pointer.v1';

function isValidPointer(value: unknown): value is SessionPointer {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SessionPointer>;
  return (
    typeof candidate.studentId === 'string' &&
    typeof candidate.sessionId === 'string' &&
    typeof candidate.chapterId === 'string' &&
    typeof candidate.mode === 'string'
  );
}

function readPointer(): SessionPointer | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return isValidPointer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writePointer(pointer: SessionPointer): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pointer));
}

function clearPointer(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export const sessionPointerStore = {
  readPointer,
  writePointer,
  clearPointer,
};
