import { afterEach, describe, expect, it, vi } from 'vitest';
import { authService } from '../../src/services/authService';

function mockFetchOnce(status: number, body?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

describe('authService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registerTeacher posts to the register endpoint with credentials included', async () => {
    const teacher = { id: 't1', email: 'a@b.com', name: 'A' };
    mockFetchOnce(200, teacher);

    const result = await authService.registerTeacher('a@b.com', 'password123', 'A');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/teacher/register'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result).toEqual(teacher);
  });

  it('registerTeacher throws the backend detail message on failure', async () => {
    mockFetchOnce(400, { detail: 'Email already registered' });

    await expect(authService.registerTeacher('a@b.com', 'password123', 'A')).rejects.toThrow(
      'Email already registered',
    );
  });

  it('loginTeacher posts credentials and returns the profile', async () => {
    const teacher = { id: 't1', email: 'a@b.com', name: 'A' };
    mockFetchOnce(200, teacher);

    const result = await authService.loginTeacher('a@b.com', 'password123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/teacher/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result).toEqual(teacher);
  });

  it('createClass posts the class name and returns the join code', async () => {
    const classGroup = { id: 'c1', name: 'Section A', code: 'ABC123' };
    mockFetchOnce(200, classGroup);

    const result = await authService.createClass('Section A');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/teacher/classes'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result).toEqual(classGroup);
  });

  it('joinClass posts classCode/displayName/pin', async () => {
    const student = { id: 's1', classId: 'c1', displayName: 'Asha' };
    mockFetchOnce(200, student);

    const result = await authService.joinClass('ABC123', 'Asha', '1234');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/student/join'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result).toEqual(student);
  });

  it('loginStudent throws the backend detail message on 401', async () => {
    mockFetchOnce(401, { detail: 'Invalid class code, name, or PIN' });

    await expect(authService.loginStudent('ABC123', 'Asha', '9999')).rejects.toThrow(
      'Invalid class code, name, or PIN',
    );
  });

  it('getCurrentUser returns undefined on 401 without throwing', async () => {
    mockFetchOnce(401);

    const result = await authService.getCurrentUser();

    expect(result).toBeUndefined();
  });

  it('getCurrentUser returns the current user when logged in', async () => {
    const currentUser = { role: 'teacher', id: 't1', name: 'A' };
    mockFetchOnce(200, currentUser);

    const result = await authService.getCurrentUser();

    expect(result).toEqual(currentUser);
  });

  it('logout posts to the logout endpoint with credentials included', async () => {
    mockFetchOnce(200, { ok: true });

    await authService.logout();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
