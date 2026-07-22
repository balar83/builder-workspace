import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { questionService } from '../services/questionService';
import type { Chapter } from '../types/chapter';

export default function ChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    setChapter(undefined);
    questionService.getChapter(chapterId).then((result) => {
      if (!cancelled) {
        setChapter(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  return (
    <main className="container">
      <h1>{chapter ? chapter.title : 'Chapter'}</h1>

      <p className="tagline">
        {chapter
          ? chapter.description
          : 'Chapter content will be available here. (Placeholder)'}
      </p>
    </main>
  );
}
