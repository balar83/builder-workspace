import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackLink from '../components/BackLink';
import { authService } from '../services/authService';
import type { StudentProfile } from '../types/auth';
import './StudentJoinPage.css';

export default function StudentJoinPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'join' | 'login'>('join');
  const [classCode, setClassCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [student, setStudent] = useState<StudentProfile | undefined>(undefined);

  // Takes the submit event so the panel can be a real <form>: Enter submits
  // from any field, and a phone keyboard's Go key works. Students type a
  // code, a name and a PIN here — three fields where Enter is the natural
  // thing to press, and none of them responded to it before.
  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError('');
    try {
      const profile =
        mode === 'join'
          ? await authService.joinClass(classCode, displayName, pin)
          : await authService.loginStudent(classCode, displayName, pin);
      setStudent(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (student) {
    return (
      <main className="container container-hero">
        <h1>Welcome, {student.displayName}!</h1>
        <div className="button-group">
          <button onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
        </div>
      </main>
    );
  }

  return (
    <main className="container container-hero">
      <BackLink to="/" label="Home" />

      <form className="form-panel" onSubmit={handleSubmit}>
        <header className="student-join-header">
          <h1>{mode === 'join' ? 'Join Your Class' : 'Student Log In'}</h1>
          <p className="page-lead">Math Thinking Coach</p>
        </header>

        <div className="form-field">
          <label htmlFor="class-code">Class code</label>
          <input
            id="class-code"
            type="text"
            value={classCode}
            onChange={(event) => setClassCode(event.target.value)}
            placeholder="e.g. ABC123"
          />
        </div>

        <div className="form-field">
          <label htmlFor="display-name">Your name</label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="student-pin">4-digit PIN</label>
          <input
            id="student-pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
        </div>

        {error && (
          <p className="form-error" aria-live="polite">
            {error}
          </p>
        )}

        <button type="submit">{mode === 'join' ? 'Join Class' : 'Log In'}</button>

        <p className="student-join-switch">
          <button
            type="button"
            className="link-button"
            onClick={() => setMode(mode === 'join' ? 'login' : 'join')}
          >
            {mode === 'join' ? 'Already joined? Log in' : 'New here? Join a class'}
          </button>
        </p>
      </form>
    </main>
  );
}
