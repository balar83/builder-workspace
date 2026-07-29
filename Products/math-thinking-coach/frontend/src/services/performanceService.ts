import { API_BASE_URL } from '../config/api';
import type { TopicPerformance } from '../types/performance';

async function getMyPerformance(): Promise<TopicPerformance[]> {
  const response = await fetch(`${API_BASE_URL}/performance/me`, {
    credentials: 'include',
  });

  // No student session is not an error condition here - RequireStudent owns
  // redirecting unauthenticated visitors away from any page that calls this;
  // a page that does render should just show no performance yet.
  if (response.status === 401) {
    return [];
  }
  if (!response.ok) {
    throw new Error('Failed to load performance');
  }
  return response.json();
}

export const performanceService = {
  getMyPerformance,
};
