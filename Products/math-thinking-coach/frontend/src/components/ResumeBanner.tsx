import { useNavigate } from 'react-router-dom';
import './ResumeBanner.css';

export interface ResumeBannerProps {
  chapterTitle: string;
  sessionId: string;
}

export default function ResumeBanner({ chapterTitle, sessionId }: ResumeBannerProps) {
  const navigate = useNavigate();

  return (
    <div className="resume-banner">
      <p className="resume-banner-text">Continue where you left off in {chapterTitle}?</p>
      <button type="button" className="resume-banner-button" onClick={() => navigate(`/session/${sessionId}`)}>
        Resume Session
      </button>
    </div>
  );
}
