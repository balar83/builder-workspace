import './HintPanel.css';

export interface HintPanelProps {
  hints: string[];
  currentHintIndex: number;
}

export default function HintPanel({ hints, currentHintIndex }: HintPanelProps) {
  const visibleHints = hints.slice(0, currentHintIndex);

  return (
    <section className="hint-panel" aria-live="polite">
      <h3 className="hint-panel-title">Hints</h3>

      {currentHintIndex === 0 ? (
        <p className="hint-panel-empty">No hints revealed yet.</p>
      ) : (
        <ul className="hint-panel-list">
          {visibleHints.map((hint, index) => (
            <li key={`${hint}-${index}`} className="hint-panel-item">
              {hint}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
