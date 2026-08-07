import { useNavigate } from 'react-router-dom';
import './BackLink.css';

export interface BackLinkProps {
  to: string;
  label: string;
}

// One consistent navigation pattern used everywhere a page needs a way
// back that isn't the browser's own Back button (Release 0.1.2 RC, Part 1:
// no screen should require browser back, URL editing, or browser history).
// Always the same position (top of the content column), same style, same
// "← " prefix — so the pattern is recognizable regardless of which page
// it appears on (Part 5: consistent navigation patterns).
export default function BackLink({ to, label }: BackLinkProps) {
  const navigate = useNavigate();

  return (
    <button type="button" className="link-button back-link" onClick={() => navigate(to)}>
      ← {label}
    </button>
  );
}
