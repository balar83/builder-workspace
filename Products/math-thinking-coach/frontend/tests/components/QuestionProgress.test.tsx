import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QuestionProgress from '../../src/components/QuestionProgress';

describe('QuestionProgress', () => {
  it('renders the correct number of steps and marks the current one', () => {
    render(<QuestionProgress totalQuestions={3} currentQuestion={2} />);

    expect(screen.getByLabelText('Question progress')).toBeDefined();
    expect(screen.getByText('✓')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });
});
