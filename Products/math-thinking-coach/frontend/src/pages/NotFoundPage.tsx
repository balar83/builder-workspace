import { useNavigate } from 'react-router-dom';

// Any URL that matches no route at all previously rendered an empty <div
// id="root">: a blank white page with no text, no heading and no control of
// any kind, escapable only via the browser's own Back button. That is the
// one dead end the rest of this release's navigation work was written to
// eliminate, and it is reachable from a mistyped or truncated shared link,
// a stale bookmark, or any link typo — no unusual behaviour required.
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="container container-hero">
      <h1>Page not found</h1>
      <p className="tagline">
        That link doesn&apos;t point anywhere in Math Thinking Coach. It may be out of date, or
        mistyped.
      </p>

      <div className="button-group">
        <button onClick={() => navigate('/')}>Go to Home</button>
        <button className="btn-secondary" onClick={() => navigate('/chapters')}>
          Browse chapters
        </button>
      </div>
    </main>
  );
}
