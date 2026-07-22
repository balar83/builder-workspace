import { useEffect, useState } from 'react';
import ChapterCard from '../components/ChapterCard';
import { questionService } from '../services/questionService';
import type { Chapter } from '../types/chapter';
import './ChapterSelectionPage.css';

export default function ChapterSelectionPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    let cancelled = false;

    questionService.getChapters().then((result) => {
      if (!cancelled) {
        setChapters(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="container">
      <h1>Select Chapter</h1>

      <p className="tagline">Choose a chapter to start exploring concepts.</p>

      <div className="chapter-grid">
        {chapters.map((c) => (
          <ChapterCard key={c.id} chapter={c} />
        ))}
      </div>
    </main>
  );
}
