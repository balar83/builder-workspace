import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { questionService } from '../services/questionService';
import type { Chapter } from '../types/chapter';
import type { Question } from '../types/question';
import AnswerInput from '../components/AnswerInput';
import DifficultyBadge from '../components/DifficultyBadge';
import HintPanel from '../components/HintPanel';
import ProgressBar from '../components/ProgressBar';
import QuestionProgress from '../components/QuestionProgress';
import SolutionPanel from '../components/SolutionPanel';
import './QuestionPage.css';

export default function QuestionPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);
  const [chapterQuestions, setChapterQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const currentQuestion = chapterQuestions[currentQuestionIndex];

  useEffect(() => {
    let cancelled = false;

    setChapter(undefined);
    setChapterQuestions([]);
    setCurrentQuestionIndex(0);
    setCurrentHintIndex(0);
    setShowSolution(false);
    setAnswer('');
    setSubmitted(false);

    Promise.all([questionService.getChapter(chapterId), questionService.getQuestions(chapterId)]).then(
      ([chapterResult, questionsResult]) => {
        if (!cancelled) {
          setChapter(chapterResult);
          setChapterQuestions(questionsResult);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  if (!chapter || !chapterQuestions.length || !currentQuestion) {
    return (
      <main className="container">
        <h1>Question</h1>
        <p>Question not found for the selected chapter.</p>
        <button onClick={() => navigate('/chapters')}>Back to chapters</button>
      </main>
    );
  }

  const totalQuestions = chapterQuestions.length;
  const totalHints = currentQuestion.hints.length || 1;
  const percent = Math.round((currentHintIndex / totalHints) * 100);
  const isAllHintsRevealed = currentHintIndex >= totalHints;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleHint = () => {
    setCurrentHintIndex((previous) => Math.min(totalHints, previous + 1));
  };

  const buttonLabel =
    currentHintIndex === 0
      ? 'Need a Hint'
      : isAllHintsRevealed
        ? 'All Hints Revealed'
        : 'Show Next Hint';

  const handleSolutionReveal = () => {
    setShowSolution(true);
  };

  const handleQuestionComplete = () => {
    if (isLastQuestion) {
      navigate('/chapters');
      return;
    }

    setCurrentQuestionIndex((previous) => previous + 1);
    setCurrentHintIndex(0);
    setShowSolution(false);
    setAnswer('');
    setSubmitted(false);
  };

  const handleAnswerSubmit = () => {
    setSubmitted(true);
  };

  return (
    <main className="container question-page">
      <div className="question-header">
        <div>
          <h2 className="chapter-name">{chapter.title}</h2>
          <QuestionProgress totalQuestions={totalQuestions} currentQuestion={currentQuestionIndex + 1} />
          <div className="meta-row">
            <span className="q-number">Question {currentQuestionIndex + 1} of {totalQuestions}</span>
            <DifficultyBadge level={currentQuestion.difficulty} />
          </div>
        </div>
      </div>

      <section className="question-card">
        <p className="question-text">{currentQuestion.question}</p>

        <AnswerInput value={answer} onChange={setAnswer} onSubmit={handleAnswerSubmit} />
        {submitted && (
          <p className="question-text">Answer evaluation will be available after backend integration.</p>
        )}

        <div className="hint-row">
          {showSolution ? (
            isLastQuestion ? (
              <div>
                <p className="question-text">Chapter Complete!</p>
                <button className="hint-button" type="button" onClick={() => navigate('/chapters')}>
                  Return to Chapters
                </button>
              </div>
            ) : (
              <button className="hint-button" type="button" onClick={handleQuestionComplete}>
                Mark Question Complete
              </button>
            )
          ) : isAllHintsRevealed ? (
            <button className="hint-button" type="button" onClick={handleSolutionReveal}>
              Reveal Solution
            </button>
          ) : (
            <button className="hint-button" type="button" onClick={handleHint}>
              {buttonLabel}
            </button>
          )}

          <div className="progress-wrap">
            <small>{currentHintIndex} / {totalHints} hints used</small>
            <ProgressBar percent={percent} />
          </div>
        </div>

        <HintPanel hints={currentQuestion.hints} currentHintIndex={currentHintIndex} />
        {showSolution && <SolutionPanel solution={currentQuestion.solution} />}
      </section>
    </main>
  );
}
