export type Difficulty = 'Easy' | 'Medium' | 'Hard';

// Kept in sync by hand with backend/app/schemas/question.py's QuestionType -
// only "short_text" and "numeric" (Slice 1), "single_choice" (Slice 2),
// "multi_choice" (Slice 3), and "multi_part" (M3) have real evaluators/UI;
// the rest are reserved, named values a future slice implements one at a
// time.
export type QuestionType =
  | 'short_text'
  | 'numeric'
  | 'single_choice'
  | 'multi_choice'
  | 'fill_blank'
  | 'matching'
  | 'multi_part';

export interface Option {
  id: string;
  text: string;
}

// M3 (multi_part): one sub-question within a multi_part Question - mirrors
// backend/app/schemas/question.py's QuestionPart exactly. Public - never
// carries the expected answer, same boundary every other type respects.
export interface QuestionPart {
  id: string;
  prompt: string;
  questionType: QuestionType;
  responseSpecification: ResponseSpecification | null;
  maxScore: number;
  objectiveIds: string[] | null;
}

// Deliberately minimal, mirroring the backend: never carries which option
// is correct or any other expected-answer value - only public, safe
// presentation metadata. See backend/app/schemas/question.py's
// ResponseSpecification docstring for the full ADR-001 boundary rationale.
export interface ResponseSpecification {
  numericTolerance: number;
  options: Option[] | null;
  // M3 (multi_part): the ordered list of sub-questions. null for every
  // other questionType.
  parts: QuestionPart[] | null;
}

export interface Question {
  id: string;
  chapterId: string;
  question: string;
  text: string;
  difficulty: Difficulty;
  hints: string[];
  solution: string;
  topicId?: string | null;
  // Always present on the wire (Pydantic serializes every declared field,
  // defaulting to "short_text"/null) - not optional.
  questionType: QuestionType;
  responseSpecification: ResponseSpecification | null;
}
