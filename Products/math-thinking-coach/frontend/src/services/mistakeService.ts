import { API_BASE_URL } from '../config/api';
import type { UnresolvedMistake } from '../types/mistake';

async function getMyMistakes(): Promise<UnresolvedMistake[]> {
  const response = await fetch(`${API_BASE_URL}/performance/me/mistakes`, {
    credentials: 'include',
  });

  // Same no-session-is-not-an-error handling as performanceService.ts/
  // activityService.ts/recoveryService.ts - RequireStudent owns redirecting
  // unauthenticated visitors away from Dashboard; a page that does render
  // should just show no unresolved mistakes yet.
  if (response.status === 401) {
    return [];
  }
  if (!response.ok) {
    throw new Error('Failed to load mistakes');
  }
  return response.json();
}

export const mistakeService = {
  getMyMistakes,
};
