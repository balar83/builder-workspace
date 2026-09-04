import './RemediationPanel.css';

export interface RemediationPanelProps {
  why: string;
  remediationHint: string;
}

export default function RemediationPanel({ why, remediationHint }: RemediationPanelProps) {
  return (
    <section className="remediation-panel" aria-live="polite">
      <h3 className="remediation-panel-title">Why this trips people up</h3>
      <p className="remediation-panel-why">{why}</p>
      <p className="remediation-panel-hint">{remediationHint}</p>
    </section>
  );
}
