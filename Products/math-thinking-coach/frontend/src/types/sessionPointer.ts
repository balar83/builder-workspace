import type { SessionMode } from './session';

// A convenience cache only, never authoritative - the server's session
// record is always the source of truth. A missing or stale pointer
// degrades to "no resume banner shown," never to lost progress, since
// every answer is already recorded server-side the moment it's submitted.
export interface SessionPointer {
  studentId: string;
  sessionId: string;
  chapterId: string;
  mode: SessionMode;
}
