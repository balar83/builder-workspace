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
          // Boundary 1 (A2/P1): renders in place instead of redirecting to
          // /student/join. That redirect sent a self-serve learner whose
          // identity had expired — a routine event, not an exceptional one —
          // into a class-join form asking for a class code they have never
          // had, with no self-serve option on it. Class joining stays
          // reachable from its own deliberate entry point on Home; it is
          // never an involuntary recovery path for a lost learner identity.
          // Deliberately does NOT mint a new identity here: a route guard is
          // the wrong place to silently create a learner.
          setState('unauthorized');
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
  }, [retryToken]);

  // Deliberately kept distinct from 'unreachable' below: "we can't confirm
  // who you are" and "we can't reach the server at all" are different facts
  // and need different copy — the latter can honestly promise the learner's
  // progress is safe, this one cannot.
  if (state === 'unauthorized') {
    return (
      <main className="container">
        <h1>We couldn&apos;t find your progress</h1>
        <p className="page-lead">
          This can happen if you haven&apos;t practised for a while, or if you&apos;re using a
          different browser or device. You can keep learning from the home page — new practice
          will be saved here.
        </p>
        <div className="button-group">
          <button onClick={() => navigate('/')}>Go to Home</button>
        </div>
      </main>
    );
  }

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
