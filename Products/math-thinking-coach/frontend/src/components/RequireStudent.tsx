import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

type GuardState = 'checking' | 'authorized' | 'unauthorized' | 'unreachable';

export default function RequireStudent({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<GuardState>('checking');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('checking');

    authService
      .getCurrentUser()
      .then((user) => {
        if (cancelled) {
          return;
        }

        if (user?.role === 'student') {
          setState('authorized');
        } else {
          setState('unauthorized');
          navigate('/student/join', { replace: true });
        }
      })
      // getCurrentUser resolves to undefined for a clean 401, so reaching
      // here means the check itself failed — the server is unreachable or
      // erroring, which is NOT the same as "not logged in" and must not
      // redirect to the join form. Without this branch the guard stayed in
      // 'checking' forever, leaving Dashboard, Start Practice and Session
      // as permanent "Loading…" screens with no control of any kind — the
      // pages' own error states never got to render, because the guard
      // never let them mount.
      .catch(() => {
        if (!cancelled) {
          setState('unreachable');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, retryToken]);

  if (state === 'unreachable') {
    return (
      <main className="container">
        <h1>Can&apos;t reach Math Thinking Coach</h1>
        <p className="page-lead">
          We couldn&apos;t confirm you&apos;re signed in. Check your connection and try again — your
          progress is saved.
        </p>
        <div className="button-group">
          <button onClick={() => setRetryToken((token) => token + 1)}>Try again</button>
          <button className="btn-secondary" onClick={() => navigate('/')}>
            Go to Home
          </button>
        </div>
      </main>
    );
  }

  if (state !== 'authorized') {
    return (
      <main className="container">
        <h1>Loading…</h1>
      </main>
    );
  }

  return <>{children}</>;
}
