import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SessionModeSelector, { type SessionConfig } from '../../src/components/SessionModeSelector';

const baseConfig: SessionConfig = {
  mode: 'practice',
  difficulty: 'Mixed',
  questionCount: 10,
  timeLimitMinutes: 15,
};

describe('SessionModeSelector', () => {
  it('offers exactly the four allowed difficulty values', () => {
    render(<SessionModeSelector value={baseConfig} onChange={vi.fn()} />);

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Mixed', 'Easy', 'Medium', 'Hard']);
  });

  it('has no question-type control', () => {
    render(<SessionModeSelector value={baseConfig} onChange={vi.fn()} />);

    expect(screen.queryByLabelText(/question type/i)).not.toBeInTheDocument();
  });

  it('hides the time limit field when mode is not test', () => {
    render(<SessionModeSelector value={baseConfig} onChange={vi.fn()} />);

    expect(screen.queryByLabelText(/time limit/i)).not.toBeInTheDocument();
  });

  it('shows the time limit field when mode is test', () => {
    render(<SessionModeSelector value={{ ...baseConfig, mode: 'test' }} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/time limit/i)).toBeInTheDocument();
  });

  it('calls onChange with the new mode when a mode is selected', () => {
    const onChange = vi.fn();
    render(<SessionModeSelector value={baseConfig} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: /test/i }));

    expect(onChange).toHaveBeenCalledWith({ ...baseConfig, mode: 'test' });
  });

  it('calls onChange with the new question count when edited', () => {
    const onChange = vi.fn();
    render(<SessionModeSelector value={baseConfig} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/number of questions/i), { target: { value: '5' } });

    expect(onChange).toHaveBeenCalledWith({ ...baseConfig, questionCount: 5 });
  });
});
