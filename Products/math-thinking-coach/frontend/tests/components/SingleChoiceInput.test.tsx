import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SingleChoiceInput from '../../src/components/SingleChoiceInput';

const OPTIONS = [
  { id: 'opt-a', text: '12' },
  { id: 'opt-b', text: '16' },
  { id: 'opt-c', text: '20' },
];

describe('SingleChoiceInput', () => {
  it('renders every option as its own radio choice', () => {
    render(<SingleChoiceInput options={OPTIONS} value="" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByRole('radio', { name: '12' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '16' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '20' })).toBeInTheDocument();
  });

  it('allows exactly one option to be selected at a time', () => {
    const onChange = vi.fn();
    render(<SingleChoiceInput options={OPTIONS} value="" onChange={onChange} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: '16' }));
    expect(onChange).toHaveBeenCalledWith('opt-b');
  });

  it('reflects the currently selected option as checked', () => {
    render(<SingleChoiceInput options={OPTIONS} value="opt-b" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByRole('radio', { name: '16' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '12' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '20' })).not.toBeChecked();
  });

  it('submits the selected option id when a selection has been made', () => {
    const onSubmit = vi.fn();
    render(<SingleChoiceInput options={OPTIONS} value="opt-b" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('does not allow submission before any option is selected', () => {
    const onSubmit = vi.fn();
    render(<SingleChoiceInput options={OPTIONS} value="" onChange={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('radio', { name: '12' }).closest('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit while disabled, even with a selection already made', () => {
    const onSubmit = vi.fn();
    render(<SingleChoiceInput options={OPTIONS} value="opt-b" onChange={vi.fn()} onSubmit={onSubmit} disabled />);

    expect(screen.getByRole('radio', { name: '16' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeDisabled();
  });
});
