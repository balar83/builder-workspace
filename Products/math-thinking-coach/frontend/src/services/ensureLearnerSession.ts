import { authService } from './authService';

// Ensures a role="student" identity exists before entering a server-backed
// learning flow that requires one (e.g. the Session engine's
// /practice/:chapterId route, gated by RequireStudent). Reuses the exact
// sequence already approved and proven in QuestionPage.tsx's own
// ensureLearnerIdentity: getCurrentUser() first; only mint a new
// SelfServeLearner via startLearner() when no identity exists at all. Any
// resolved user - an existing self-serve learner, a class-connected
// Student, or even a teacher session for a caller that doesn't care about
// role - is left completely untouched, never replaced.
//
// Extracted as its own module (rather than duplicated inline, or factored
// out of QuestionPage.tsx) so this new call site and QuestionPage.tsx's
// existing, unmodified implementation both exist independently - per this
// slice's explicit scope, QuestionPage.tsx is not touched.
export async function ensureLearnerSession(): Promise<void> {
  const user = await authService.getCurrentUser();
  if (!user) {
    await authService.startLearner();
  }
}
