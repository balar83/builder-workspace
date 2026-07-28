import type { StoredProgress } from '../types/progress';

const STORAGE_KEY = 'mtc.progress.v1';
const SCHEMA_VERSION = 1;

function emptyProgress(): StoredProgress {
  return {
    schemaVersion: SCHEMA_VERSION,
    lastActiveChapterId: null,
    chapters: {},
  };
}

function isValidStoredProgress(value: unknown): value is StoredProgress {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredProgress>;
  return (
    candidate.schemaVersion === SCHEMA_VERSION &&
    typeof candidate.chapters === 'object' &&
    candidate.chapters !== null
  );
}

function readProgress(): StoredProgress {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyProgress();
  }

  try {
    const parsed = JSON.parse(raw);
    return isValidStoredProgress(parsed) ? parsed : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function writeProgress(data: StoredProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export const progressStore = {
  readProgress,
  writeProgress,
  clearProgress,
};
