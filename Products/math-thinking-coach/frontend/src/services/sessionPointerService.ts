import type { SessionPointer } from '../types/sessionPointer';
import { sessionPointerStore } from './sessionPointerStore';

function setActiveSession(pointer: SessionPointer): void {
  sessionPointerStore.writePointer(pointer);
}

// Scoped to the current student, not just "whatever pointer is in
// localStorage" - a shared-device PIN swap to a different student must
// never surface a resume banner for someone else's session.
function getActiveSessionFor(studentId: string): SessionPointer | undefined {
  const pointer = sessionPointerStore.readPointer();
  return pointer && pointer.studentId === studentId ? pointer : undefined;
}

function clearActiveSession(): void {
  sessionPointerStore.clearPointer();
}

// Only clears when the stored pointer actually points at this session -
// never blindly wipes whatever pointer happens to be stored.
function clearActiveSessionIfMatches(sessionId: string): void {
  const pointer = sessionPointerStore.readPointer();
  if (pointer && pointer.sessionId === sessionId) {
    sessionPointerStore.clearPointer();
  }
}

export const sessionPointerService = {
  setActiveSession,
  getActiveSessionFor,
  clearActiveSession,
  clearActiveSessionIfMatches,
};
