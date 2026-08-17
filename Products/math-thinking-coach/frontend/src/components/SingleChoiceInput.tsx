import type { Option } from '../types/question';
import './SingleChoiceInput.css';

export interface SingleChoiceInputProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

// Mirrors AnswerInput's own form-submit pattern (Enter/mobile "Go" key
// still works) - the only difference is what's inside the form. value is
// the selected option's id, or '' when nothing is chosen yet; the wire
// submission (AnswerSubmission.answer) carries that same string
// unchanged - no new submission shape was needed for single_choice.
export default function SingleChoiceInput({
  options,
  value,
  onChange,
  onSubmit,
  disabled = false,
}: SingleChoiceInputProps) {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled || !value) {
      return;
    }
    onSubmit();
  };

  return (
    <form className="single-choice-input" onSubmit={handleSubmit}>
      <fieldset className="single-choice-fieldset">
        <legend className="answer-input-label">Choose one</legend>
        {options.map((option) => (
          <label key={option.id} className="single-choice-option">
            <input
              type="radio"
              name="single-choice-option"
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              disabled={disabled}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
      <button className="answer-input-button" type="submit" disabled={disabled || !value}>
        Check Answer
      </button>
    </form>
  );
}
