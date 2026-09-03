import { API_BASE_URL } from '../config/api';
import type { ClassGroup, CurrentUser, StudentProfile, TeacherProfile } from '../types/auth';

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.detail === 'string' ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

async function registerTeacher(
  email: string,
  password: string,
  name: string,
): Promise<TeacherProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/teacher/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to register'));
  }
  return response.json();
}

async function loginTeacher(email: string, password: string): Promise<TeacherProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/teacher/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Invalid email or password'));
  }
  return response.json();
}

async function createClass(name: string): Promise<ClassGroup> {
  const response = await fetch(`${API_BASE_URL}/auth/teacher/classes`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create class'));
  }
  return response.json();
}

async function joinClass(
  classCode: string,
  displayName: string,
  pin: string,
): Promise<StudentProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/student/join`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classCode, displayName, pin }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to join class'));
  }
  return response.json();
}

async function loginStudent(
  classCode: string,
  displayName: string,
  pin: string,
): Promise<StudentProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/student/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classCode, displayName, pin }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Invalid class code, name, or PIN'));
  }
  return response.json();
}

// Establishes a self-serve learner session (no class/teacher relationship).
// The backend route is itself idempotent - it returns the existing identity
// unchanged if the caller already holds a valid student-role session - but a
// caller here should still check getCurrentUser() first and only call this
// when it resolves to undefined, per the approved "no appropriate session ->
// create; existing session -> preserve" flow. No page currently calls this;
// wiring a real entry point is a separate, deferred product decision.
async function startLearner(): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/auth/learner/start`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to start learner session'));
  }
  return response.json();
}

async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

async function getCurrentUser(): Promise<CurrentUser | undefined> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
  });
  if (response.status === 401) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error('Failed to load current user');
  }
  return response.json();
}

export const authService = {
  registerTeacher,
  loginTeacher,
  createClass,
  joinClass,
  loginStudent,
  startLearner,
  logout,
  getCurrentUser,
};
