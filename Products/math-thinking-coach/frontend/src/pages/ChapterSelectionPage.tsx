import ChapterCard from '../components/ChapterCard';
import { questionService } from '../services/questionService';
import './ChapterSelectionPage.css';

export default function ChapterSelectionPage() {
  const chapters = questionService.getChapters();

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
