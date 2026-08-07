import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import RequireStudent from '../../src/components/RequireStudent';

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

describe('RequireStudent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockNavigate.mockClear();
  });

  it('renders children when a student session exists', async () => {
    mockFetchOnce(200, { role: 'student', id: 's1', name: 'Asha' });

    render(
      <RequireStudent>
        <p>Protected</p>
      </RequireStudent>,
    );

    expect(await screen.findByText('Protected')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to /student/join when not logged in', async () => {
    mockFetchOnce(401);

    render(
      <RequireStudent>
        <p>Protected</p>
      </RequireStudent>,
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/student/join', { replace: true }));
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('redirects to /student/join when logged in as a teacher, not a student', async () => {
    mockFetchOnce(200, { role: 'teacher', id: 't1', name: 'Mr. X' });

    render(
      <RequireStudent>
        <p>Protected</p>
      </RequireStudent>,
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/student/join', { replace: true }));
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  // Release 0.1.2 final audit: the guard had no rejection branch, so a
  // failed /auth/me left it in 'checking' forever. Every route behind it
  // (Dashboard, Start Practice, Session) became a permanent "Loading…"
  // screen with no control of any kind — the pages' own error states never
  // mounted. A failed check is also NOT "not logged in", so it must not
  // redirect to the join form.
  it('offers a recoverable error state when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    render(
      <RequireStudent>
        <p>Protected</p>
      </RequireStudent>,
    );

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
