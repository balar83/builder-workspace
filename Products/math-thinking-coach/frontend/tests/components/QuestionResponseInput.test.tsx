import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuestionResponseInput from '../../src/components/QuestionResponseInput';

describe('QuestionResponseInput', () => {
  it('renders the free-text AnswerInput for questionType "short_text" (existing behavior, unchanged)', () => {
    render(
      <QuestionResponseInput
        questionType="short_text"
        responseSpecification={null}
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Type your answer')).toBeInTheDocument();
  });

  it('renders the free-text AnswerInput for questionType "numeric" (existing behavior, unchanged)', () => {
    render(
      <QuestionResponseInput
        questionType="numeric"
        responseSpecification={{ numericTolerance: 0.05, options: null }}
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Type your answer')).toBeInTheDocument();
  });

  it('renders SingleChoiceInput for questionType "single_choice" with real options', () => {
    render(
      <QuestionResponseInput
        questionType="single_choice"
        responseSpecification={{
          numericTolerance: 0,
          options: [
            { id: 'opt-a', text: '12' },
            { id: 'opt-b', text: '16' },
          ],
        }}
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('radio', { name: '12' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '16' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Type your answer')).not.toBeInTheDocument();
  });

  it('falls back to the free-text AnswerInput if single_choice has no options (defensive, never crashes the page)', () => {
    render(
      <QuestionResponseInput
        questionType="single_choice"
        responseSpecification={null}
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Type your answer')).toBeInTheDocument();
  });

  it('falls back to the free-text AnswerInput for a still-reserved questionType (e.g. matching)', () => {
    render(
      <QuestionResponseInput
        questionType="matching"
        responseSpecification={null}
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Type your answer')).toBeInTheDocument();
  });
});
