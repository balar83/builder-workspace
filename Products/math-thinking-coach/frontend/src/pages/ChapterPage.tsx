import { useParams } from 'react-router-dom';
import { questionService } from '../services/questionService';

export default function ChapterPage() {
  const { chapterId } = useParams<{ chapterId: string }>();

  const chapter = questionService.getChapter(chapterId);

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