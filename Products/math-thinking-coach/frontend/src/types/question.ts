export type Difficulty = 'Easy' | 'Medium' | 'Hard';

// Kept in sync by hand with backend/app/schemas/question.py's QuestionType -
// only "short_text" and "numeric" (Slice 1) and "single_choice" (Slice 2)
// have real evaluators/UI; the rest are reserved, named values a future
// slice implements one at a time.
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

// Deliberately minimal, mirroring the backend: never carries which option
// is correct or any other expected-answer value - only public, safe
// presentation metadata. See backend/app/schemas/question.py's
// ResponseSpecification docstring for the full ADR-001 boundary rationale.
export interface ResponseSpecification {
  numericTolerance: number;
  options: Option[] | null;
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
