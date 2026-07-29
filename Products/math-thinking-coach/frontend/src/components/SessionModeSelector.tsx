import './SessionModeSelector.css';
import type { RequestedDifficulty, SessionMode } from '../types/session';

export interface SessionConfig {
  mode: SessionMode;
  difficulty: RequestedDifficulty;
  questionCount: number;
  timeLimitMinutes: number;
}

export interface SessionModeSelectorProps {
  value: SessionConfig;
  onChange: (value: SessionConfig) => void;
  // The chapter's total question count, when known - caps the number-of-
  // questions input so a student can't request an obviously impossible
  // amount. Uniform across modes deliberately (not narrowed by difficulty
  // or Revision's weak-topic scoping) - a real shortfall can still legitimately
  // occur for those narrower cases, and existing shortfall messaging already
  // handles it.
  maxQuestionCount?: number;
}

const MODES: { value: SessionMode; label: string; description: string }[] = [
  { value: 'practice', label: 'Practice', description: 'Unlimited time, no score shown.' },
  { value: 'revision', label: 'Revision', description: 'Focuses on your weaker topics.' },
  { value: 'test', label: 'Test', description: 'Timed, with a self-feedback score at the end.' },
];

// Exactly the four values RequestedDifficulty accepts - no free text, and
// deliberately no question-type control anywhere in this form (see
// types/session.ts's note on CreateSessionRequest).
const DIFFICULTIES: RequestedDifficulty[] = ['Mixed', 'Easy', 'Medium', 'Hard'];

export default function SessionModeSelector({ value, onChange, maxQuestionCount }: SessionModeSelectorProps) {
  return (
    <div className="session-mode-selector">
      <fieldset className="session-mode-field">
        <legend>Mode</legend>
        {MODES.map((option) => (
          <label key={option.value} className="session-mode-option">
            <input
              type="radio"
              name="session-mode"
              value={option.value}
              checked={value.mode === option.value}
              onChange={() => onChange({ ...value, mode: option.value })}
            />
            <span>
              <strong>{option.label}</strong> — {option.description}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="session-mode-field">
        <label htmlFor="session-difficulty">Difficulty</label>
        <select
          id="session-difficulty"
          value={value.difficulty}
          onChange={(event) => onChange({ ...value, difficulty: event.target.value as RequestedDifficulty })}
        >
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficulty}
            </option>
          ))}
        </select>
      </div>

      <div className="session-mode-field">
        <label htmlFor="session-question-count">Number of questions</label>
        <input
          id="session-question-count"
          type="number"
          min={1}
          max={maxQuestionCount}
          value={value.questionCount}
          onChange={(event) => {
            const raw = Number(event.target.value);
            const clamped = maxQuestionCount !== undefined ? Math.min(raw, maxQuestionCount) : raw;
            onChange({ ...value, questionCount: clamped });
          }}
        />
        {maxQuestionCount !== undefined && (
          <small className="session-mode-hint">This chapter has {maxQuestionCount} question{maxQuestionCount === 1 ? '' : 's'} available.</small>
        )}
      </div>

      {value.mode === 'test' && (
        <div className="session-mode-field">
          <label htmlFor="session-time-limit">Time limit (minutes)</label>
          <input
            id="session-time-limit"
            type="number"
            min={1}
            value={value.timeLimitMinutes}
            onChange={(event) => onChange({ ...value, timeLimitMinutes: Number(event.target.value) })}
          />
        </div>
      )}
    </div>
  );
}
