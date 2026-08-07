import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import BackLink from '../components/BackLink';
import { questionService } from '../services/questionService';
import type { Topic } from '../types/topic';
import './TopicPage.css';

// Average adult silent reading speed is ~220 wpm; Class 8 students reading
// unfamiliar mathematical prose are slower, so this deliberately rounds
// conservatively rather than flattering the number.
const WORDS_PER_MINUTE = 160;

function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// The runtime Topic model stores `explanation` as one string: the export
// pipeline joins each authored section's body with a blank line and drops
// the section titles entirely (transformTopic). Splitting on that blank
// line recovers the paragraph structure the author wrote, which is what
// makes the page readable at all. Section *headings* cannot be recovered
// here without a schema change, which is out of scope for this release —
// see the Release 0.1.2 notes.
function toParagraphs(explanation: string): string[] {
  return explanation
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

// Worked examples are exported as "problem \n\n Step 1: … \n\n answer",
// with multiple examples separated by a --- rule. Splitting them back out
// lets each example render as its own card with its steps as a real list.
interface WorkedExample {
  problem: string;
  steps: string[];
  answer: string;
}

function toWorkedExamples(content: string): WorkedExample[] {
  return content
    .split(/\n\s*---\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const steps = lines.filter((line) => /^Step\s+\d+:/i.test(line));
      const firstStepIndex = lines.findIndex((line) => /^Step\s+\d+:/i.test(line));
      const lastStepIndex = lines.map((line) => /^Step\s+\d+:/i.test(line)).lastIndexOf(true);

      const problem = (firstStepIndex === -1 ? lines : lines.slice(0, firstStepIndex)).join(' ');
      const answer = lastStepIndex === -1 ? '' : lines.slice(lastStepIndex + 1).join(' ');

      return { problem, steps, answer };
    })
    .filter((example) => example.problem || example.steps.length > 0);
}

export default function TopicPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Topic | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  // Set when the student arrives from the authenticated Dashboard (IA-1):
  // it decides whether "Start Practice" continues into a configured
  // session or into the anonymous question flow, and where Back returns to.
  const fromDashboard = searchParams.get('from') === 'dashboard';

  useEffect(() => {
    let cancelled = false;

    setTopic(undefined);
    setNotFound(false);
    setLoadError(false);

    questionService
      .getTopic(topicId)
      .then((result) => {
        if (!cancelled) {
          setTopic(result);
          setNotFound(result === undefined);
        }
      })
      // A 404 already resolves to undefined, so a rejection here means the
      // request itself failed. Without this the page sat on "Loading…"
      // indefinitely with no heading, no message and no way out.
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [topicId, retryToken]);

  const paragraphs = useMemo(() => (topic ? toParagraphs(topic.explanation) : []), [topic]);
  const workedExamples = useMemo(
    () => (topic ? toWorkedExamples(topic.workedExampleContent) : []),
    [topic],
  );

  if (loadError) {
    return (
      <main className="container">
        <div className="content-column">
          <h1>Lesson</h1>
          <p className="page-lead">
            We couldn&apos;t load this lesson. Check your connection and try again.
          </p>
          <div className="button-group topic-notfound-actions">
            <button onClick={() => setRetryToken((token) => token + 1)}>Try again</button>
            <button className="btn-secondary" onClick={() => navigate('/chapters')}>
              Back to chapters
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (notFound || !topic) {
    return (
      <main className="container">
        <div className="content-column">
          <h1>Lesson</h1>
          <p className="page-lead">{notFound ? 'This lesson is not available.' : 'Loading…'}</p>
          {notFound && (
            <div className="button-group topic-notfound-actions">
              <button onClick={() => navigate('/chapters')}>Back to chapters</button>
            </div>
          )}
        </div>
      </main>
    );
  }

  const minutes = readingMinutes(topic.explanation);

  const backTarget = fromDashboard ? '/dashboard' : `/chapter/${topic.chapterId}`;
  const backLabel = fromDashboard ? 'Dashboard' : 'Chapter';
  const handlePractice = () =>
    navigate(fromDashboard ? `/practice/${topic.chapterId}` : `/question/${topic.chapterId}`);

  return (
    <main className="container topic-page">
      <div className="content-column">
        <nav className="topic-breadcrumb" aria-label="Breadcrumb">
          <BackLink to={backTarget} label={backLabel} />
        </nav>

        <header className="topic-header">
          <p className="topic-eyebrow">Lesson</p>
          <h1>{topic.title}</h1>
          <p className="topic-meta">
            {minutes} min read
            {topic.learningObjectives.length > 0 && (
              <> · {topic.learningObjectives.length} learning objectives</>
            )}
          </p>
        </header>

        <article className="topic-explanation">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </article>

        {workedExamples.length > 0 && (
          <section className="topic-section" aria-labelledby="worked-examples-heading">
            <h2 id="worked-examples-heading" className="topic-section-heading">
              Worked examples
            </h2>

            {workedExamples.map((example, index) => (
              <figure className="worked-example" key={index}>
                <figcaption className="worked-example-label">
                  Example {index + 1}
                </figcaption>

                {example.problem && <p className="worked-example-problem">{example.problem}</p>}

                {example.steps.length > 0 && (
                  <ol className="worked-example-steps">
                    {example.steps.map((step, stepIndex) => (
                      <li key={stepIndex}>{step.replace(/^Step\s+\d+:\s*/i, '')}</li>
                    ))}
                  </ol>
                )}

                {example.answer && (
                  <p className="worked-example-answer">
                    <span className="worked-example-answer-label">Answer</span>
                    {example.answer}
                  </p>
                )}
              </figure>
            ))}
          </section>
        )}

        {topic.learningObjectives.length > 0 && (
          <section className="topic-section" aria-labelledby="objectives-heading">
            <h2 id="objectives-heading" className="topic-section-heading">
              What you should be able to do
            </h2>
            <ul className="topic-objectives">
              {topic.learningObjectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="topic-cta">
          <button type="button" onClick={handlePractice}>
            Start Practice →
          </button>
          <p className="topic-cta-note">Put this lesson into practice with guided questions.</p>
        </div>
      </div>
    </main>
  );
}
