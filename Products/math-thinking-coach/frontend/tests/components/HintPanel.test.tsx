import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HintPanel from '../../src/components/HintPanel';

describe('HintPanel', () => {
  it('shows empty state when no hints are revealed', () => {
    render(<HintPanel hints={['Hint 1', 'Hint 2']} currentHintIndex={0} />);
    expect(screen.getByText('Hints')).toBeDefined();
    expect(screen.getByText('No hints revealed yet.')).toBeDefined();
  });

  it('shows only the revealed hints', () => {
    render(<HintPanel hints={['Hint 1', 'Hint 2', 'Hint 3']} currentHintIndex={2} />);
    expect(screen.getByText('Hint 1')).toBeDefined();
    expect(screen.getByText('Hint 2')).toBeDefined();
    expect(screen.queryByText('Hint 3')).toBeNull();
  });
});
