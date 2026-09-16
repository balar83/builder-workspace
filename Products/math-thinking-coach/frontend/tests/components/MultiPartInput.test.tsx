import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MultiPartInput from '../../src/components/MultiPartInput';
import type { QuestionPart } from '../../src/types/question';

const PARTS: QuestionPart[] = [
  { id: 'lhs', prompt: 'LHS (left-hand side)', questionType: 'short_text', responseSpecification: null, maxScore: 1, objectiveIds: null },
  { id: 'rhs', prompt: 'RHS (right-hand side)', questionType: 'short_text', responseSpecification: null, maxScore: 1, objectiveIds: null },
];

describe('MultiPartInput', () => {
  it('renders one labeled field per part', () => {
    render(<MultiPartInput parts={PARTS} value="" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('LHS (left-hand side)')).toBeInTheDocument();
    expect(screen.getByLabelText('RHS (right-hand side)')).toBeInTheDocument();
  });

  it('typing into the first part emits the canonical "|"-delimited positional string', () => {
    const onChange = vi.fn();
    render(<MultiPartInput parts={PARTS} value="" onChange={onChange} onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('LHS (left-hand side)'), { target: { value: '9 - 2x' } });

    expect(onChange).toHaveBeenCalledWith('9 - 2x|');
  });

  it('typing into the second part preserves the first part already entered', () => {
    const onChange = vi.fn();
    render(<MultiPartInput parts={PARTS} value="9 - 2x|" onChange={onChange} onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('RHS (right-hand side)'), { target: { value: '5x + 2' } });

    expect(onChange).toHaveBeenCalledWith('9 - 2x|5x + 2');
  });

  it('reflects the currently split value in each field', () => {
    render(<MultiPartInput parts={PARTS} value="9 - 2x|5x + 2" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('LHS (left-hand side)')).toHaveValue('9 - 2x');
    expect(screen.getByLabelText('RHS (right-hand side)')).toHaveValue('5x + 2');
  });

  it('does not allow submission until every part has a non-empty value', () => {
    const onSubmit = vi.fn();
    render(<MultiPartInput parts={PARTS} value="9 - 2x|" onChange={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('LHS (left-hand side)').closest('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits once every part is filled', () => {
    const onSubmit = vi.fn();
    render(<MultiPartInput parts={PARTS} value="9 - 2x|5x + 2" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('does not submit while disabled, even with every part filled', () => {
    render(<MultiPartInput parts={PARTS} value="9 - 2x|5x + 2" onChange={vi.fn()} onSubmit={vi.fn()} disabled />);

    expect(screen.getByLabelText('LHS (left-hand side)')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeDisabled();
  });

  it('uses a numeric input mode for a numeric-typed part, and text for a short_text-typed part', () => {
    const numericParts: QuestionPart[] = [
      { id: 'smaller', prompt: 'The smaller number', questionType: 'numeric', responseSpecification: null, maxScore: 1, objectiveIds: null },
      { id: 'larger', prompt: 'The larger number', questionType: 'numeric', responseSpecification: null, maxScore: 1, objectiveIds: null },
    ];
    render(<MultiPartInput parts={numericParts} value="" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('The smaller number')).toHaveAttribute('inputMode', 'decimal');
    expect(screen.getByLabelText('The larger number')).toHaveAttribute('inputMode', 'decimal');
  });
});
