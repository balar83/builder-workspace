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

export interface AnswerEvaluationResponse {
  evaluation: AnswerEvaluation;
  coach: AnswerCoach;
  ui: AnswerUiState;
}
