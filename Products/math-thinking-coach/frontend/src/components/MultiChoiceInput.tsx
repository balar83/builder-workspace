import type { Option } from '../types/question';
import './SingleChoiceInput.css';

export interface MultiChoiceInputProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

// Mirrors SingleChoiceInput's own form-submit pattern, with checkboxes
// instead of radios - reuses its CSS (the --control-height fix documented
// there applies to every input type, not just radio). value is the
// selected options' ids, comma-delimited in the SAME option-list order
// every time (not click order) - the one canonical wire representation the
// backend evaluator (evaluation_service.py's _evaluate_multi_choice) and
// the private answer-keys.json entry both share. No new
// AnswerSubmission/session field was needed for multi_choice, exactly as
// single_choice needed none for its own one-id string.
export default function MultiChoiceInput({
  options,
  value,
  onChange,
  onSubmit,
  disabled = false,
}: MultiChoiceInputProps) {
  const selectedIds = new Set(
    value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '')
  );

  const toggleOption = (optionId: string) => {
    const next = new Set(selectedIds);
    if (next.has(optionId)) {
      next.delete(optionId);
    } else {
      next.add(optionId);
    }
    onChange(
      options
        .filter((option) => next.has(option.id))
        .map((option) => option.id)
        .join(',')
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled || selectedIds.size === 0) {
      return;
    }
    onSubmit();
  };

  return (
    <form className="single-choice-input" onSubmit={handleSubmit}>
      <fieldset className="single-choice-fieldset">
        <legend className="answer-input-label">Choose all that apply</legend>
        {options.map((option) => (
          <label key={option.id} className="single-choice-option">
            <input
              type="checkbox"
              name="multi-choice-option"
              value={option.id}
              checked={selectedIds.has(option.id)}
              onChange={() => toggleOption(option.id)}
              disabled={disabled}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
      <button className="answer-input-button" type="submit" disabled={disabled || selectedIds.size === 0}>
        Check Answer
      </button>
    </form>
  );
}
