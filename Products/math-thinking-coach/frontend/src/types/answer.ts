export type NextAction = 'TRY_AGAIN' | 'SHOW_HINT' | 'SHOW_SOLUTION' | 'NEXT_QUESTION';

export interface AnswerSubmission {
  answer: string;
  attemptNumber: number;
}

export interface AnswerEvaluation {
  isCorrect: boolean;
  score: number;
}

export interface AnswerCoach {
  message: string;
  nextAction: NextAction;
}

export interface AnswerUiState {
  canTryAgain: boolean;
  canRevealSolution: boolean;
  hintLevel: number;
}

// Self-Serve Learning Loop V1, Slice 5: present only for a wrong answer,
// once the coaching ladder has reached SHOW_HINT or SHOW_SOLUTION, and
// only when the question has authored remediation content at all - see
// backend answer_service.py's _build_remediation for the exact rule.
export interface AnswerRemediation {
  why: string;
  remediationHint: string;
}

export interface AnswerEvaluationResponse {
  evaluation: AnswerEvaluation;
  coach: AnswerCoach;
  ui: AnswerUiState;
  remediation: AnswerRemediation | null;
}
