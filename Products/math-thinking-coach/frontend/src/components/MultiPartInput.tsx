import type { QuestionPart } from '../types/question';
import './MultiPartInput.css';

export interface MultiPartInputProps {
  parts: QuestionPart[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

// M3. A compositional input: one labeled field per part, rendered
// according to that part's own questionType - not a generalized recursive
// UI framework, since every part this evaluator actually supports
// (le-q25/le-q37/le-q40) is short_text or numeric, both of which fit the
// same plain text field. "numeric" gets inputMode="decimal" as the only
// per-type difference; a future part questionType with a real widget
// (e.g. single_choice) would need its own branch here, not built now.
//
// Wire format matches evaluation_service._evaluate_multi_part exactly: the
// parent's flat `value` string is `parts.length` answers joined with "|",
// positional - never a recursive per-part submission shape (M3 Decision
// 1). Stateless/controlled, mirroring MultiChoiceInput's own pattern:
// part values are derived fresh from `value` on every render, never held
// as separate local state, so the parent always owns the single source of
// truth.
const PART_DELIMITER = '|';

export default function MultiPartInput({ parts, value, onChange, onSubmit, disabled = false }: MultiPartInputProps) {
  const rawTokens = value.split(PART_DELIMITER);
  const tokens = parts.map((_, index) => rawTokens[index] ?? '');

  const updatePart = (index: number, newValue: string) => {
    const next = [...tokens];
    next[index] = newValue;
    onChange(next.join(PART_DELIMITER));
  };

  const allPartsFilled = tokens.every((token) => token.trim() !== '');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled || !allPartsFilled) {
      return;
    }
    onSubmit();
  };

  return (
    <form className="multi-part-input" onSubmit={handleSubmit}>
      {parts.map((part, index) => (
        <div key={part.id} className="multi-part-field">
          <label className="answer-input-label" htmlFor={`multi-part-${part.id}`}>
            {part.prompt}
          </label>
          <input
            id={`multi-part-${part.id}`}
            className="answer-input-field"
            type="text"
            inputMode={part.questionType === 'numeric' ? 'decimal' : 'text'}
            value={tokens[index]}
            onChange={(event) => updatePart(index, event.target.value)}
            disabled={disabled}
            placeholder="Type your answer"
            autoComplete="off"
            enterKeyHint="send"
          />
        </div>
      ))}
      <button className="answer-input-button" type="submit" disabled={disabled || !allPartsFilled}>
        Check Answer
      </button>
    </form>
  );
}
