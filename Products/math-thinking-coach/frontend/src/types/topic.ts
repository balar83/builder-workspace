export interface LearningObjective {
  id: string;
  text: string;
}

export interface Concept {
  id: string;
  title: string;
  body: string;
  learningObjectives: LearningObjective[];
}

export interface WorkedExample {
  id: string;
  conceptId: string;
  problem: string;
  steps: string[];
  finalAnswer: string;
}

export interface Topic {
  id: string;
  chapterId: string;
  title: string;
  explanation: string;
  workedExampleContent: string;
  learningObjectives: string[];
  // Additive, Slice A1: structured equivalents of the three legacy fields
  // above. Always present on the API response (backend defaults to []), but
  // only actually populated for chapters that have migrated (Slice A1
  // pilot: A Square and A Cube) - empty for every other Topic-bearing
  // chapter until its own migration (Slice A2b, not yet authorized). See
  // docs/Structured-Learning-Content-Design-Proposal.md §K/§M/§W.
  concepts: Concept[];
  workedExamples: WorkedExample[];
}
