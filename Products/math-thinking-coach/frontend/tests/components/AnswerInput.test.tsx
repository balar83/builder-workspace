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
});
