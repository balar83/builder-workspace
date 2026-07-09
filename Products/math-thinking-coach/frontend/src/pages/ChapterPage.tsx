import { useParams } from 'react-router-dom';
import chapters from '../data/chapters';

export default function ChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>();

  const chapter = chapters.find((c) => c.id === chapterId);

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