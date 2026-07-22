import './AnswerInput.css';

export interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function AnswerInput({ value, onChange, onSubmit, disabled = false }: AnswerInputProps) {
  return (
    <div className="answer-input">
      <label className="answer-input-label" htmlFor="student-answer">
        Your answer
      </label>
      <div className="answer-input-row">
        <input
          id="student-answer"
          className="answer-input-field"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder="Type your answer"
        />
        <button className="answer-input-button" type="button" onClick={onSubmit} disabled={disabled}>
          Check Answer
        </button>
      </div>
    </div>
  );
}
