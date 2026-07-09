import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import chapters from '../data/chapters';
import questions from '../data/questions';
import DifficultyBadge from '../components/DifficultyBadge';
import ProgressBar from '../components/ProgressBar';
import './QuestionPage.css';

export default function QuestionPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();

  const chapter = chapters.find((c) => c.id === chapterId);
  const question = questions.find((q) => q.chapterId === chapterId);

  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);

  if (!chapter || !question) {
    return (
      <main className="container">
        <h1>Question</h1>
        <p>Question not found for the selected chapter.</p>
        <button onClick={() => navigate('/chapters')}>Back to chapters</button>
      </main>
    );
  }

  const totalHints = question.hints.length || 1;
  const percent = Math.round((hintsUsed / totalHints) * 100);

  const handleHint = () => {
    if (!showHint) {
      setHintsUsed((s) => Math.min(totalHints, s + 1));
      setShowHint(true);
    } else {
      setShowHint(false);
    }
  };

  return (
    <main className="container question-page">
      <div className="question-header">
        <div>
          <h2 className="chapter-name">{chapter.title}</h2>
          <div className="meta-row">
            <span className="q-number">Question 1 of 1</span>
            <DifficultyBadge level={question.difficulty} />
          </div>
        </div>
      </div>

      <section className="question-card">
        <p className="question-text">{question.text}</p>

        <div className="hint-row">
          <button className="hint-button" onClick={handleHint}>
            {showHint ? 'Hide Hint' : 'Need a Hint'}
          </button>

          <div className="progress-wrap">
            <small>{hintsUsed} / {totalHints} hints used</small>
            <ProgressBar percent={percent} />
          </div>
        </div>

        {showHint && (
          <div className="hint-box">
            <strong>Hint:</strong> {question.hints[0]}
          </div>
        )}
      </section>
    </main>
  );
}
