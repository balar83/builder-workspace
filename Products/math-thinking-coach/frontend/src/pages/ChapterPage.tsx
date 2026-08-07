import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackLink from '../components/BackLink';
import { progressService } from '../services/progressService';
import { questionService } from '../services/questionService';
import type { Chapter } from '../types/chapter';
import type { Question } from '../types/question';
import type { Topic } from '../types/topic';
import './ChapterPage.css';

export default function ChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  // 'loading' was previously indistinguishable from 'missing': both rendered
  // "Chapter not found.", so every visit flashed a false error before the
  // content arrived, and a network failure claimed the chapter didn't exist.
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setChapter(undefined);
    setQuestions([]);
    setTopics([]);
    setState('loading');

    Promise.all([
      questionService.getChapter(chapterId),
      questionService.getQuestions(chapterId),
      questionService.getTopics(chapterId),
    ])
      .then(([chapterResult, questionsResult, topicsResult]) => {
        if (!cancelled) {
          setChapter(chapterResult);
          setQuestions(questionsResult);
          setTopics(topicsResult);
          setState('loaded');

          if (chapterId && chapterResult) {
            progressService.setLastActiveChapter(chapterId);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId, retryToken]);

  if (state === 'error') {
    return (
      <main className="container">
        <div className="content-column">
          <BackLink to="/chapters" label="Chapters" />
          <h1>Chapter</h1>
          <p className="page-lead">
            We couldn&apos;t load this chapter. Check your connection and try again.
          </p>
          <div className="button-group">
            <button onClick={() => setRetryToken((token) => token + 1)}>Try again</button>
          </div>
        </div>
      </main>
    );
  }

  if (state === 'loading') {
    return (
      <main className="container">
        <div className="content-column">
          <BackLink to="/chapters" label="Chapters" />
          <h1>Chapter</h1>
          <p className="page-lead">Loading…</p>
        </div>
      </main>
    );
  }

  if (!chapter) {
    return (
      <main className="container">
        <div className="content-column">
          <BackLink to="/chapters" label="Chapters" />
          <h1>Chapter</h1>
          <p>Chapter not found.</p>
        </div>
      </main>
    );
  }

  const progress = chapterId ? progressService.getChapterProgress(chapterId) : undefined;
  const completedCount = chapterId ? progressService.getCompletedCount(chapterId) : 0;
  const hasStarted = Boolean(progress && Object.keys(progress.questionStatus).length > 0);

  return (
    <main className="container">
      <div className="content-column">
        <BackLink to="/chapters" label="Chapters" />

        <div className="chapter-page-body">
          <h1>{chapter.title}</h1>
          <p className="tagline">{chapter.description}</p>

          {questions.length > 0 && (
            <p className="page-lead">
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
        </div>
      </div>
    </main>
  );
}
