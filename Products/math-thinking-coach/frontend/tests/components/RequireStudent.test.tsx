import { fireEvent, render, screen } from '@testing-library/react';
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

  // Boundary 1 (A2/P1). This previously redirected to /student/join, which
  // sent a self-serve learner whose identity had expired - a routine event on
  // a rolling window, not an exceptional one - into a class-join form asking
  // for a class code they have never had. Class joining must never be an
  // involuntary recovery path for a lost learner identity.
  it('renders an in-place recovery state when not logged in, and never routes to class join', async () => {
    mockFetchOnce(401);

    render(
      <RequireStudent>
        <p>Protected</p>
      </RequireStudent>,
    );

    expect(await screen.findByRole('heading', { name: "We couldn't find your progress" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('offers the learner spine as the recovery action, going Home rather than to class join', async () => {
    mockFetchOnce(401);

    render(
      <RequireStudent>
        <p>Protected</p>
      </RequireStudent>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Go to Home' }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(mockNavigate).not.toHaveBeenCalledWith('/student/join', { replace: true });
  });

  it('renders the same recovery state when logged in as a teacher, not a student', async () => {
    mockFetchOnce(200, { role: 'teacher', id: 't1', name: 'Mr. X' });

    render(
      <RequireStudent>
        <p>Protected</p>
      </RequireStudent>,
    );

    expect(await screen.findByRole('heading', { name: "We couldn't find your progress" })).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // An expired or tampered cookie is indistinguishable from "not logged in"
  // at this layer (both surface as a clean 401), so it must follow the exact
  // same recovery path - asserted explicitly so a future change can't quietly
  // route one of them somewhere else.
  it('treats an expired or tampered session cookie the same as no identity', async () => {
    mockFetchOnce(401);

    render(
      <RequireStudent>
        <p>Protected</p>
      </RequireStudent>,
    );

    expect(await screen.findByRole('heading', { name: "We couldn't find your progress" })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/student/join', { replace: true });
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
