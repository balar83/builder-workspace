import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AnswerFeedback from '../../src/components/AnswerFeedback';

// Release 0.1.2 (UX review Q3): the coaching message previously reused the
// question text's own CSS class, so correct and not-yet-correct answers
// were visually identical to each other and to the question itself.
describe('AnswerFeedback', () => {
  it('renders the coaching message', () => {
    render(<AnswerFeedback state="correct" message="Excellent! You solved it correctly." />);

    expect(screen.getByText('Excellent! You solved it correctly.')).toBeDefined();
  });

  it('distinguishes correct from not-yet-correct visually', () => {
    const { container: correct } = render(<AnswerFeedback state="correct" message="Right" />);
    const { container: retry } = render(<AnswerFeedback state="retry" message="Not quite" />);

    expect(correct.querySelector('.answer-feedback-correct')).not.toBeNull();
    expect(retry.querySelector('.answer-feedback-retry')).not.toBeNull();
  });

  it('announces politely to assistive technology', () => {
    const { container } = render(<AnswerFeedback state="retry" message="Not quite" />);

    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
