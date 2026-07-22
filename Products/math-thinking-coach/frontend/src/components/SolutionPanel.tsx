import './SolutionPanel.css';

export interface SolutionPanelProps {
  solution: string;
}

export default function SolutionPanel({ solution }: SolutionPanelProps) {
  return (
    <section className="solution-panel" aria-live="polite">
      <h3 className="solution-panel-title">Solution</h3>
      <p className="solution-panel-text">{solution}</p>
    </section>
  );
}
