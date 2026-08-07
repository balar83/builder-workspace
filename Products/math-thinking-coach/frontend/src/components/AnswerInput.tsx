import './AnswerInput.css';

export interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function AnswerInput({ value, onChange, onSubmit, disabled = false }: AnswerInputProps) {
  // A real <form> rather than a keydown handler: it is what makes Enter
  // submit in every browser, and it is what makes a mobile keyboard show a
  // "Go" key that does something. Answering is the single most repeated
  // action in the product (44 questions in Linear Equations alone) and it
  // previously required a mouse or a tap on every one of them.
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled) {
      return;
    }
    onSubmit();
  };

  return (
    <form className="answer-input" onSubmit={handleSubmit}>
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
          autoComplete="off"
          enterKeyHint="send"
        />
        <button className="answer-input-button" type="submit" disabled={disabled}>
          Check Answer
        </button>
      </div>
    </form>
  );
}
