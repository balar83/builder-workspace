import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MultiChoiceInput from '../../src/components/MultiChoiceInput';

const OPTIONS = [
  { id: 'opt-a', text: '2' },
  { id: 'opt-b', text: '3' },
  { id: 'opt-c', text: '4' },
  { id: 'opt-d', text: '5' },
];

describe('MultiChoiceInput', () => {
  it('renders every option as its own checkbox choice', () => {
    render(<MultiChoiceInput options={OPTIONS} value="" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '4' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '5' })).toBeInTheDocument();
  });

  it('tells the student multiple answers may be selected', () => {
    render(<MultiChoiceInput options={OPTIONS} value="" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText('Choose all that apply')).toBeInTheDocument();
  });

  it('selecting an option emits the canonical comma-delimited option-order string', () => {
    const onChange = vi.fn();
    render(<MultiChoiceInput options={OPTIONS} value="" onChange={onChange} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith('opt-b');
  });

  it('serializes multiple selections in option-list order, regardless of click order', () => {
    const onChange = vi.fn();
    const { rerender } = render(<MultiChoiceInput options={OPTIONS} value="" onChange={onChange} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: '5' }));
    expect(onChange).toHaveBeenLastCalledWith('opt-d');

    rerender(<MultiChoiceInput options={OPTIONS} value="opt-d" onChange={onChange} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: '2' }));

    expect(onChange).toHaveBeenLastCalledWith('opt-a,opt-d');
  });

  it('deselecting a checked option removes it from the serialized value', () => {
    const onChange = vi.fn();
    render(<MultiChoiceInput options={OPTIONS} value="opt-a,opt-d" onChange={onChange} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: '2' }));
    expect(onChange).toHaveBeenCalledWith('opt-d');
  });

  it('reflects the currently selected options as checked', () => {
    render(<MultiChoiceInput options={OPTIONS} value="opt-a,opt-d" onChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: '2' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '5' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '3' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '4' })).not.toBeChecked();
  });

  it('submits the selected option ids when at least one selection has been made', () => {
    const onSubmit = vi.fn();
    render(<MultiChoiceInput options={OPTIONS} value="opt-a" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('does not allow submission before any option is selected', () => {
    const onSubmit = vi.fn();
    render(<MultiChoiceInput options={OPTIONS} value="" onChange={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('checkbox', { name: '2' }).closest('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit while disabled, even with selections already made', () => {
    const onSubmit = vi.fn();
    render(<MultiChoiceInput options={OPTIONS} value="opt-a,opt-d" onChange={vi.fn()} onSubmit={onSubmit} disabled />);

    expect(screen.getByRole('checkbox', { name: '2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeDisabled();
  });
});
