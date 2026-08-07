import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HintPanel from '../../src/components/HintPanel';

describe('HintPanel', () => {
  // Release 0.1.2 (UX review Q4): the panel no longer renders a "no hints
  // revealed yet" placeholder card before any hint is requested.
  it('renders nothing when no hints are revealed', () => {
    const { container } = render(<HintPanel hints={['Hint 1', 'Hint 2']} currentHintIndex={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only the revealed hints', () => {
    render(<HintPanel hints={['Hint 1', 'Hint 2', 'Hint 3']} currentHintIndex={2} />);
    expect(screen.getByText('Hint 1')).toBeDefined();
    expect(screen.getByText('Hint 2')).toBeDefined();
    expect(screen.queryByText('Hint 3')).toBeNull();
  });

  // Q5: each revealed hint is numbered so the coaching ladder is visible.
  it('numbers each revealed hint against the total', () => {
    render(<HintPanel hints={['Hint 1', 'Hint 2', 'Hint 3']} currentHintIndex={2} />);
    expect(screen.getByText('Hint 1 of 3')).toBeDefined();
    expect(screen.getByText('Hint 2 of 3')).toBeDefined();
  });
});
