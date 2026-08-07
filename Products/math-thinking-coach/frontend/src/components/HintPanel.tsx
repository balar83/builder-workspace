import './HintPanel.css';

export interface HintPanelProps {
  hints: string[];
  currentHintIndex: number;
}

// Renders nothing until the first hint is revealed. The panel previously
// occupied a full bordered card to say "No hints revealed yet." before any
// hint was requested (UX review Q4).
//
// Revealed hints are numbered and staged so the Socratic ladder is visible
// to the student rather than implicit — three flat identical paragraphs
// gave no sense of progressing through deliberate steps (Q5).
export default function HintPanel({ hints, currentHintIndex }: HintPanelProps) {
  if (currentHintIndex <= 0) {
    return null;
  }

  const visibleHints = hints.slice(0, currentHintIndex);
  const total = hints.length || visibleHints.length;

  return (
    <section className="hint-panel" aria-live="polite" aria-label="Hints">
      <ol className="hint-panel-list">
        {visibleHints.map((hint, index) => (
          <li key={`${hint}-${index}`} className="hint-panel-item">
            <p className="hint-panel-step">
              Hint {index + 1} of {total}
            </p>
            <p className="hint-panel-text">{hint}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
