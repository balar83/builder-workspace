import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QuestionProgress from '../../src/components/QuestionProgress';

// Release 0.1.2 (UX review Q2): the one-dot-per-question grid was replaced
// by a slim bar plus a count. The question count is deliberately retained —
// only its visual cost was removed.
describe('QuestionProgress', () => {
  it('reports the current question against the total', () => {
    render(<QuestionProgress totalQuestions={44} currentQuestion={7} />);

    expect(screen.getByLabelText('Question progress')).toBeDefined();
    expect(screen.getByText('Question 7 of 44')).toBeDefined();
    expect(screen.getByText('6 completed')).toBeDefined();
  });

  it('omits the completed count on the first question', () => {
    render(<QuestionProgress totalQuestions={3} currentQuestion={1} />);

    expect(screen.getByText('Question 1 of 3')).toBeDefined();
    expect(screen.queryByText(/completed/)).toBeNull();
  });

  it('fills the bar in proportion to completed questions', () => {
    const { container } = render(<QuestionProgress totalQuestions={4} currentQuestion={3} />);

    const inner = container.querySelector('.progress-inner') as HTMLElement;
    expect(inner.style.width).toBe('50%');
  });
});
