import './QuestionProgress.css';

export interface QuestionProgressProps {
  totalQuestions: number;
  currentQuestion: number;
}

export default function QuestionProgress({ totalQuestions, currentQuestion }: QuestionProgressProps) {
  const steps = Array.from({ length: totalQuestions }, (_, index) => index + 1);

  return (
    <div className="question-progress" aria-label="Question progress">
      {steps.map((step) => {
        const isCompleted = step < currentQuestion;
        const isCurrent = step === currentQuestion;

        return (
          <div
            key={step}
            className={`question-progress-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {isCompleted ? '✓' : step}
          </div>
        );
      })}
    </div>
  );
}
