import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, describe, it, expect, vi } from 'vitest';

// Minimal, meaningful E2E-equivalent for the lesson-page UX slice.
//
// This repository has no browser-level E2E framework (Playwright/Cypress) -
// introducing one was judged out of scope for this slice (see the
// implementation report). This is the closest practical substitute using
// the testing stack already in place: a REAL react-router-dom (unlike the
// existing single-page tests in this directory, which mock it out) driving
// the REAL ChapterPage -> TopicPage -> QuestionPage components, with only
// the network-facing service layer mocked. A click here triggers a real
// route change and mounts the real next page, the same way a browser does.
vi.mock('../../src/services/questionService', () => ({
  questionService: {
    getChapter: vi.fn(),
    getQuestions: vi.fn(),
    getTopics: vi.fn(),
    getTopic: vi.fn(),
    submitAnswer: vi.fn(),
  },
}));

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    startLearner: vi.fn(),
  },
}));

import ChapterPage from '../../src/pages/ChapterPage';
import TopicPage from '../../src/pages/TopicPage';
import QuestionPage from '../../src/pages/QuestionPage';
import { authService } from '../../src/services/authService';
import { questionService } from '../../src/services/questionService';

const chapter = { id: 'linear-equations', title: 'Linear Equations', description: 'Solving linear equations.' };

const topic = {
  id: 'topic-linear-equations-one-variable',
  chapterId: 'linear-equations',
  title: 'Solving Linear Equations in One Variable',
  explanation: '',
  workedExampleContent: '',
  learningObjectives: [],
  concepts: [
    {
      id: 'concept-le-basics',
      title: 'What is a linear equation?',
      body: 'An equation is a statement that two expressions are equal.',
      learningObjectives: [{ id: 'obj-le-lhs-rhs', text: 'Identify the LHS and RHS of an equation.' }],
    },
    {
      id: 'concept-le-transposition',
      title: 'Solving with transposition',
      body: 'Moving a term across the equals sign flips its sign.',
      learningObjectives: [{ id: 'obj-le-transposition', text: 'Solve an equation using transposition.' }],
    },
  ],
  workedExamples: [
    {
      id: 'le-we-01',
      conceptId: 'concept-le-basics',
      problem: 'Is x = 4 a solution of 3x - 5 = 7?',
      steps: ['Substitute x = 4 into the LHS.'],
      finalAnswer: 'Yes.',
    },
    {
      id: 'le-we-02',
      conceptId: 'concept-le-transposition',
      problem: 'Solve for x: 4x + 5 = 2x + 17.',
      steps: ['Transpose 2x to the left.'],
      finalAnswer: 'x = 6.',
    },
  ],
};

const question = {
  id: 'le-q01',
  chapterId: 'linear-equations',
  question: 'Solve for x: 2x = 36',
  text: 'Solve for x: 2x = 36',
  difficulty: 'Easy' as const,
  hints: ['Divide both sides by 2'],
  solution: 'x = 18',
  questionType: 'short_text' as const,
  responseSpecification: null,
};

// Same three routes App.tsx wires for this journey - a deliberately narrow
// mount (not the whole App) so this test doesn't also have to stub the
// auth/session services the class-joined routes depend on.
//
// /practice/:chapterId is a bare placeholder, not the real (RequireStudent-
// gated) StartPracticePage - this file only needs to prove TopicPage's new
// CTA actually navigates there after establishing identity; the guarded
// route's own behavior is out of scope here (and unmodified by this slice).
function PracticeRoutePlaceholder() {
  return <div>Practice session placeholder</div>;
}

function renderJourney(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/chapter/:chapterId" element={<ChapterPage />} />
        <Route path="/topic/:topicId" element={<TopicPage />} />
        <Route path="/question/:chapterId" element={<QuestionPage />} />
        <Route path="/practice/:chapterId" element={<PracticeRoutePlaceholder />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Chapter -> lesson -> practice journey (lesson-page UX slice)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('reaches the lesson from the chapter page, then reaches practice from the TOP shortcut CTA', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([question]);
    vi.mocked(questionService.getTopics).mockResolvedValue([topic]);
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);

    renderJourney('/chapter/linear-equations');

    fireEvent.click(await screen.findByRole('button', { name: 'Learn' }));

    await screen.findByRole('heading', { name: topic.title, level: 1 });

    // Two "Start Practice" CTAs now exist (top shortcut + unchanged bottom
    // one) - the top one is this slice's new behaviour.
    const practiceButtons = await screen.findAllByRole('button', { name: /Start Practice/ });
    expect(practiceButtons.length).toBe(2);
    fireEvent.click(practiceButtons[0]);

    await waitFor(() => expect(screen.getByText('Solve for x: 2x = 36')).toBeInTheDocument());
  });

  it('the unchanged bottom end-of-lesson CTA still reaches practice', async () => {
    vi.mocked(questionService.getChapter).mockResolvedValue(chapter);
    vi.mocked(questionService.getQuestions).mockResolvedValue([question]);
    vi.mocked(questionService.getTopics).mockResolvedValue([topic]);
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);

    renderJourney('/topic/topic-linear-equations-one-variable');

    const practiceButtons = await screen.findAllByRole('button', { name: /Start Practice/ });
    fireEvent.click(practiceButtons[practiceButtons.length - 1]);

    await waitFor(() => expect(screen.getByText('Solve for x: 2x = 36')).toBeInTheDocument());
  });

  it('the jump-to-section nav links use the exact same anchor ids the Dashboard deep-links to', async () => {
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);

    renderJourney('/topic/topic-linear-equations-one-variable');

    await screen.findByRole('heading', { name: topic.title, level: 1 });

    for (const concept of topic.concepts) {
      const link = screen.getByRole('link', { name: concept.title });
      expect(link).toHaveAttribute('href', `#concept-heading-${concept.id}`);

      // The element that href actually resolves to must exist with that
      // exact id - this is what a Dashboard "Review" deep link
      // (ChapterPerformanceCard's reviewConcept) depends on.
      const heading = document.getElementById(`concept-heading-${concept.id}`);
      expect(heading).not.toBeNull();
      expect(heading?.textContent).toBe(concept.title);
    }
  });

  it('a Dashboard-style deep link (?from=dashboard#concept-heading-<id>) still has a matching anchor in the DOM', async () => {
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);

    renderJourney(
      '/topic/topic-linear-equations-one-variable?from=dashboard#concept-heading-concept-le-transposition',
    );

    await screen.findByRole('heading', { name: topic.title, level: 1 });

    expect(document.getElementById('concept-heading-concept-le-transposition')).not.toBeNull();
  });

  it('only the first worked example on the page is open by default; later ones start collapsed', async () => {
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);

    const { container } = renderJourney('/topic/topic-linear-equations-one-variable');

    await screen.findByRole('heading', { name: topic.title, level: 1 });

    // Numbering restarts per concept ("Example 1" appears under both
    // concepts here, since each has exactly one), so document order - not
    // text - is what identifies "first on the page" vs "later".
    const examples = container.querySelectorAll<HTMLDetailsElement>('details.worked-example');
    expect(examples.length).toBe(2);
    expect(examples[0].open).toBe(true);
    expect(examples[1].open).toBe(false);
  });
});

describe('TopicPage - second Practice entry point into the Session engine (approved slice)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('offers a distinct tracked-session CTA on a direct (non-Dashboard) visit', async () => {
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);

    renderJourney('/topic/topic-linear-equations-one-variable');

    await screen.findByRole('heading', { name: topic.title, level: 1 });

    expect(
      screen.getByRole('button', { name: /Start a Tracked Practice Session/ }),
    ).toBeInTheDocument();
  });

  it('does not offer the second CTA when arriving from Dashboard - the existing button already reaches the Session engine there', async () => {
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);

    renderJourney('/topic/topic-linear-equations-one-variable?from=dashboard');

    await screen.findByRole('heading', { name: topic.title, level: 1 });

    expect(
      screen.queryByRole('button', { name: /Start a Tracked Practice Session/ }),
    ).not.toBeInTheDocument();
  });

  it('establishes a fresh learner identity before navigating into the Session engine', async () => {
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);

    const callOrder: string[] = [];
    vi.mocked(authService.getCurrentUser).mockImplementation(async () => {
      callOrder.push('getCurrentUser');
      return undefined;
    });
    vi.mocked(authService.startLearner).mockImplementation(async () => {
      callOrder.push('startLearner');
      return { role: 'student' as const, id: 'learner_fresh', name: null };
    });

    renderJourney('/topic/topic-linear-equations-one-variable');
    await screen.findByRole('heading', { name: topic.title, level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /Start a Tracked Practice Session/ }));

    await screen.findByText('Practice session placeholder');

    // Sequenced, not concurrent: identity is fully established (and, since
    // none existed, created) before the route change into the Session
    // engine ever happens.
    expect(callOrder).toEqual(['getCurrentUser', 'startLearner']);
  });

  it('reuses an existing session without creating a duplicate learner', async () => {
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      role: 'student',
      id: 'existing-learner',
      name: null,
    });

    renderJourney('/topic/topic-linear-equations-one-variable');
    await screen.findByRole('heading', { name: topic.title, level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /Start a Tracked Practice Session/ }));

    await screen.findByText('Practice session placeholder');

    expect(authService.startLearner).not.toHaveBeenCalled();
  });

  it('shows an error and does not navigate when identity establishment fails', async () => {
    vi.mocked(questionService.getTopic).mockResolvedValue(topic);
    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('network down'));

    renderJourney('/topic/topic-linear-equations-one-variable');
    await screen.findByRole('heading', { name: topic.title, level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /Start a Tracked Practice Session/ }));

    await screen.findByText(/couldn't start a practice session/i);
    expect(screen.queryByText('Practice session placeholder')).not.toBeInTheDocument();
  });
});
