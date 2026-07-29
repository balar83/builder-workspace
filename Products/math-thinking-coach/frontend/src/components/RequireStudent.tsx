import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

type GuardState = 'checking' | 'authorized' | 'unauthorized';

export default function RequireStudent({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<GuardState>('checking');

  useEffect(() => {
    let cancelled = false;

    authService.getCurrentUser().then((user) => {
      if (cancelled) {
        return;
      }

      if (user?.role === 'student') {
        setState('authorized');
      } else {
        setState('unauthorized');
        navigate('/student/join', { replace: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (state !== 'authorized') {
    return (
      <main className="container">
        <p>Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
