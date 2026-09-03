import { API_BASE_URL } from '../config/api';
import type { ActivityResponse } from '../types/activity';

async function getMyActivity(): Promise<ActivityResponse> {
  const response = await fetch(`${API_BASE_URL}/performance/me/activity`, {
    credentials: 'include',
  });

  // Same no-session-is-not-an-error handling as performanceService.ts's
  // getMyPerformance/getMyConceptPerformance - RequireStudent owns
  // redirecting unauthenticated visitors away from Dashboard; a page that
  // does render should just show no activity yet.
  if (response.status === 401) {
    return { recentAttempts: [], chapterActivity: [] };
  }
  if (!response.ok) {
    throw new Error('Failed to load activity');
  }
  return response.json();
}

export const activityService = {
  getMyActivity,
};
