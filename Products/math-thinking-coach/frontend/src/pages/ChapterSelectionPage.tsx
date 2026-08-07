import { useEffect, useState } from 'react';
import BackLink from '../components/BackLink';
import ChapterCard from '../components/ChapterCard';
import { questionService } from '../services/questionService';
import type { Chapter } from '../types/chapter';
import './ChapterSelectionPage.css';

type LoadState = 'loading' | 'loaded' | 'error';

export default function ChapterSelectionPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    questionService
      .getChapters()
      .then((result) => {
        if (!cancelled) {
          setChapters(result);
          setState('loaded');
        }
      })
      // Previously unhandled: a failed request left `chapters` at [] and the
      // page rendered its heading over an empty space with no message, no
      // spinner and no retry — indistinguishable from "this product has no
      // chapters".
      .catch(() => {
        if (!cancelled) {
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  return (
    <main className="container">
      <div className="content-column">
        <BackLink to="/" label="Home" />

        <h1>Select Chapter</h1>
        <p className="tagline">Choose a chapter to start exploring concepts.</p>

        {state === 'loading' && <p className="page-lead">Loading chapters…</p>}

        {state === 'error' && (
          <>
            <p className="page-lead">
              We couldn&apos;t load the chapters. Check your connection and try again.
            </p>
            <div className="button-group">
              <button onClick={() => setRetryToken((token) => token + 1)}>Try again</button>
            </div>
          </>
        )}

        {state === 'loaded' && chapters.length === 0 && (
          <p className="page-lead">No chapters are available yet.</p>
        )}

        {state === 'loaded' && chapters.length > 0 && (
          <div className="chapter-grid">
            {chapters.map((c) => (
              <ChapterCard key={c.id} chapter={c} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
