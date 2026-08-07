import ProgressBar from './ProgressBar';
import './QuestionProgress.css';

export interface QuestionProgressProps {
  totalQuestions: number;
  currentQuestion: number;
}

// Replaces the previous one-dot-per-question grid, which rendered 44
// non-interactive circles occupying 35% of the mobile viewport and pushed
// the question itself below the fold (UX review Q2). The question count is
// deliberately retained — only its visual cost is removed.
export default function QuestionProgress({ totalQuestions, currentQuestion }: QuestionProgressProps) {
  const completed = Math.max(0, currentQuestion - 1);
  const percent = totalQuestions > 0 ? Math.round((completed / totalQuestions) * 100) : 0;

  return (
    <div className="question-progress" aria-label="Question progress">
      <div className="question-progress-meta">
        <span className="question-progress-count">
          Question {currentQuestion} of {totalQuestions}
        </span>
        {completed > 0 && <span className="question-progress-completed">{completed} completed</span>}
      </div>
      <ProgressBar percent={percent} />
    </div>
  );
}
