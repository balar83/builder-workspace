import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const handleSubmit = async () => {
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
      <main className="container">
        <h1>Welcome, {student.displayName}!</h1>
        <div className="button-group">
          <button onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>{mode === 'join' ? 'Join Your Class' : 'Student Log In'}</h1>

      <div className="student-join-field">
        <label htmlFor="class-code">Class code</label>
        <input
          id="class-code"
          type="text"
          value={classCode}
          onChange={(event) => setClassCode(event.target.value)}
          placeholder="e.g. ABC123"
        />
      </div>

      <div className="student-join-field">
        <label htmlFor="display-name">Your name</label>
        <input
          id="display-name"
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>

      <div className="student-join-field">
        <label htmlFor="student-pin">4-digit PIN</label>
        <input
          id="student-pin"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
      </div>

      {error && <p className="student-join-error">{error}</p>}

      <div className="button-group">
        <button onClick={handleSubmit}>{mode === 'join' ? 'Join Class' : 'Log In'}</button>
        <button onClick={() => setMode(mode === 'join' ? 'login' : 'join')}>
          {mode === 'join' ? 'Already joined? Log in' : 'New here? Join a class'}
        </button>
      </div>
    </main>
  );
}
