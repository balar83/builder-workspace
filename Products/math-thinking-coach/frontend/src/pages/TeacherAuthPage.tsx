import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { ClassGroup, TeacherProfile } from '../types/auth';
import './TeacherAuthPage.css';

export default function TeacherAuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const [teacher, setTeacher] = useState<TeacherProfile | undefined>(undefined);
  const [className, setClassName] = useState('');
  const [createdClass, setCreatedClass] = useState<ClassGroup | undefined>(undefined);
  const [classError, setClassError] = useState('');

  const handleSubmit = async () => {
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

  const handleCreateClass = async () => {
    setClassError('');
    try {
      const classGroup = await authService.createClass(className);
      setCreatedClass(classGroup);
      setClassName('');
    } catch (err) {
      setClassError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (teacher) {
    return (
      <main className="container">
        <h1>Welcome, {teacher.name}</h1>

        <div className="teacher-auth-field">
          <label htmlFor="class-name">New class name</label>
          <input
            id="class-name"
            type="text"
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            placeholder="e.g. Section A"
          />
        </div>
        {classError && <p className="teacher-auth-error">{classError}</p>}
        <div className="button-group">
          <button onClick={handleCreateClass}>Create Class</button>
        </div>

        {createdClass && (
          <p className="teacher-auth-code">
            "{createdClass.name}" join code: <strong>{createdClass.code}</strong>
          </p>
        )}

        <div className="button-group">
          <button onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Teacher {mode === 'login' ? 'Login' : 'Registration'}</h1>

      <div className="teacher-auth-field">
        <label htmlFor="teacher-email">Email</label>
        <input
          id="teacher-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      {mode === 'register' && (
        <div className="teacher-auth-field">
          <label htmlFor="teacher-name">Name</label>
          <input
            id="teacher-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      )}

      <div className="teacher-auth-field">
        <label htmlFor="teacher-password">Password</label>
        <input
          id="teacher-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error && <p className="teacher-auth-error">{error}</p>}

      <div className="button-group">
        <button onClick={handleSubmit}>{mode === 'login' ? 'Log In' : 'Register'}</button>
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account? Register' : 'Already registered? Log in'}
        </button>
      </div>
    </main>
  );
}
