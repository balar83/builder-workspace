import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { progressService } from '../services/progressService';
import { questionService } from '../services/questionService';
import type { Chapter } from '../types/chapter';
import type { Question } from '../types/question';
import type { Topic } from '../types/topic';

export default function ChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    let cancelled = false;

    setChapter(undefined);
    setQuestions([]);
    setTopics([]);

    Promise.all([
      questionService.getChapter(chapterId),
      questionService.getQuestions(chapterId),
      questionService.getTopics(chapterId),
    ]).then(([chapterResult, questionsResult, topicsResult]) => {
      if (!cancelled) {
        setChapter(chapterResult);
        setQuestions(questionsResult);
        setTopics(topicsResult);

        if (chapterId && chapterResult) {
          progressService.setLastActiveChapter(chapterId);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  if (!chapter) {
    return (
      <main className="container">
        <h1>Chapter</h1>
        <p>Chapter not found.</p>
        <button onClick={() => navigate('/chapters')}>Back to chapters</button>
      </main>
    );
  }

  const progress = chapterId ? progressService.getChapterProgress(chapterId) : undefined;
  const completedCount = chapterId ? progressService.getCompletedCount(chapterId) : 0;
  const hasStarted = Boolean(progress && Object.keys(progress.questionStatus).length > 0);

  return (
    <main className="container">
      <h1>{chapter.title}</h1>
      <p className="tagline">{chapter.description}</p>

      {questions.length > 0 && (
        <p>
          {completedCount} of {questions.length} completed
        </p>
      )}

      <div className="button-group">
        {topics.length > 0 ? (
          <button onClick={() => navigate(`/topic/${topics[0].id}`)}>Learn</button>
        ) : (
          <button onClick={() => navigate(`/question/${chapterId}`)}>
            {hasStarted ? 'Continue Learning' : 'Start Learning'}
          </button>
        )}
      </div>
    </main>
  );
}
