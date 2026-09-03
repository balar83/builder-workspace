export type UserRole = 'teacher' | 'student';

export interface TeacherProfile {
  id: string;
  email: string;
  name: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  code: string;
}

export interface StudentProfile {
  id: string;
  classId: string;
  displayName: string;
}

export interface CurrentUser {
  role: UserRole;
  id: string;
  // null for a self-serve learner (SelfServeLearner has no display name to
  // report) - existing teacher/student callers always still get a string.
  name: string | null;
}
