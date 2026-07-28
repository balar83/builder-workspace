import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { questionService } from '../services/questionService';
import type { Topic } from '../types/topic';
import './TopicPage.css';

export default function TopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Topic | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setTopic(undefined);
    setNotFound(false);

    questionService.getTopic(topicId).then((result) => {
      if (!cancelled) {
        setTopic(result);
        setNotFound(result === undefined);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [topicId]);

  if (notFound || !topic) {
    return (
      <main className="container">
        <h1>Topic</h1>
        <p>{notFound ? 'Topic not found.' : ''}</p>
        <button onClick={() => navigate('/chapters')}>Back to chapters</button>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>{topic.title}</h1>
      <p className="tagline">{topic.explanation}</p>

      <h3>Worked Example</h3>
      <p className="worked-example">{topic.workedExampleContent}</p>

      <h3>Learning Objectives</h3>
      <ul>
        {topic.learningObjectives.map((objective) => (
          <li key={objective}>{objective}</li>
        ))}
      </ul>

      <div className="button-group">
        <button onClick={() => navigate(`/question/${topic.chapterId}`)}>Start Practice</button>
      </div>
    </main>
  );
}
