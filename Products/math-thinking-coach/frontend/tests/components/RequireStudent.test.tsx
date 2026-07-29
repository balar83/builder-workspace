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
});
