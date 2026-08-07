import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackLink from '../components/BackLink';
import { authService } from '../services/authService';
import type { ClassGroup } from '../types/auth';
import './TeacherAuthPage.css';

// Only the display name is ever read here. Restoring a session yields a
// CurrentUser (no email), so narrowing to what the page actually uses
// avoids fabricating an empty email field just to satisfy TeacherProfile.
type SignedInTeacher = { name: string };

export default function TeacherAuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(true);

  const [teacher, setTeacher] = useState<SignedInTeacher | undefined>(undefined);
  const [className, setClassName] = useState('');
  const [createdClass, setCreatedClass] = useState<ClassGroup | undefined>(undefined);
  const [classError, setClassError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  // Identity was previously held in React state only, so any refresh or
  // return visit dropped a still-valid server session back to the login
  // form (UX review T5). Mirrors the student side, which already restores
  // via getCurrentUser (RequireStudent / DashboardPage). Read-only — no
  // change to auth or session handling.
  useEffect(() => {
    let cancelled = false;

    authService
      .getCurrentUser()
      .then((user) => {
        if (!cancelled && user?.role === 'teacher') {
          setTeacher({ name: user.name });
        }
      })
      .catch(() => {
        // A failed restore just means "show the login form" — never a
        // blocking error state.
      })
      .finally(() => {
        if (!cancelled) {
          setRestoring(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Both handlers take the submit event so the panels can be real <form>s:
  // pressing Enter in any field submits, and mobile keyboards get a working
  // Go key. Previously neither form responded to Enter at all.
  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError('');
    try {
      const profile =
        mode === 'login'
          ? await authService.loginTeacher(email, password)
          : await authService.registerTeacher(email, password, name);
      setTeacher(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const handleCreateClass = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setClassError('');
    setCodeCopied(false);
    try {
      const classGroup = await authService.createClass(className);
      setCreatedClass(classGroup);
      setClassName('');
    } catch (err) {
      setClassError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const handleCopyCode = async () => {
    if (!createdClass) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdClass.code);
      setCodeCopied(true);
    } catch {
      setCodeCopied(false);
    }
  };

  // Matches DashboardPage's handleLogout exactly (Part 5: teacher pages
  // match student pages) — logout is the one exit affordance once
  // authenticated, in both places, rather than a separate "back to home"
  // link that would leave a live session behind unexplained.
  const handleLogout = () => {
    authService.logout().finally(() => navigate('/'));
  };

  if (restoring) {
    return (
      <main className="container container-hero">
        <p className="page-lead">Loading…</p>
      </main>
    );
  }

  if (teacher) {
    return (
      <main className="container container-hero">
        <div className="teacher-home-header">
          <div>
            <h1>Welcome, {teacher.name}</h1>
            <p className="tagline">Create a class to get a join code for your students.</p>
          </div>
          <button type="button" className="link-button" onClick={handleLogout}>
            Log out
          </button>
        </div>

        <form className="form-panel" onSubmit={handleCreateClass}>
          <div className="form-field">
            <label htmlFor="class-name">New class name</label>
            <input
              id="class-name"
              type="text"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="e.g. Section A"
            />
          </div>

          {classError && (
            <p className="form-error" aria-live="polite">
              {classError}
            </p>
          )}

          <button type="submit">Create Class</button>

          {createdClass && (
            <div className="teacher-code-card" aria-live="polite">
              <p className="teacher-code-label">Join code for "{createdClass.name}"</p>
              <p className="teacher-code-value">{createdClass.code}</p>
              <button type="button" className="btn-secondary teacher-code-copy" onClick={handleCopyCode}>
                {codeCopied ? 'Copied' : 'Copy code'}
              </button>
              <p className="teacher-code-warning">
                Save this now — students need it to join, and it is not shown again after you leave this page.
              </p>
            </div>
          )}
        </form>
      </main>
    );
  }

  return (
    <main className="container container-hero">
      <BackLink to="/" label="Home" />

      <form className="form-panel" onSubmit={handleSubmit}>
        <header className="teacher-panel-header">
          <h1>Teacher {mode === 'login' ? 'login' : 'registration'}</h1>
          <p className="page-lead">Math Thinking Coach</p>
        </header>

        <div className="form-field">
          <label htmlFor="teacher-email">Email</label>
          <input
            id="teacher-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {mode === 'register' && (
          <div className="form-field">
            <label htmlFor="teacher-name">Name</label>
            <input
              id="teacher-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        )}

        <div className="form-field">
          <label htmlFor="teacher-password">Password</label>
          <input
            id="teacher-password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && (
          <p className="form-error" aria-live="polite">
            {error}
          </p>
        )}

        <button type="submit">{mode === 'login' ? 'Log In' : 'Register'}</button>

        <p className="teacher-mode-switch">
          <button
            type="button"
            className="link-button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already registered? Log in'}
          </button>
        </p>
      </form>
    </main>
  );
}
