import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnswerInput from '../../src/components/AnswerInput';

describe('AnswerInput', () => {
  it('renders the input and calls onSubmit', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(<AnswerInput value="hello" onChange={onChange} onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText('Type your answer');
    fireEvent.change(input, { target: { value: 'world' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    expect(onChange).toHaveBeenCalledWith('world');
    expect(onSubmit).toHaveBeenCalled();
  });

  // Release 0.1.2 final audit: answering is the most repeated action in the
  // product and Enter did nothing at all — the field was a bare <input>
  // outside any form, so neither a desktop Enter press nor a phone
  // keyboard's Go key reached onSubmit.
  it('submits when Enter is pressed in the field', () => {
    const onSubmit = vi.fn();

    render(<AnswerInput value="42" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByPlaceholderText('Type your answer'));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('does not submit while disabled', () => {
    const onSubmit = vi.fn();

    render(<AnswerInput value="42" onChange={vi.fn()} onSubmit={onSubmit} disabled />);

    fireEvent.submit(screen.getByPlaceholderText('Type your answer'));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
