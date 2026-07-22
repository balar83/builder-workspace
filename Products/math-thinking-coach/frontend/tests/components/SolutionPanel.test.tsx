import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SolutionPanel from '../../src/components/SolutionPanel';

describe('SolutionPanel', () => {
  it('renders the provided solution text', () => {
    render(<SolutionPanel solution="42" />);
    expect(screen.getByText('Solution')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
  });
});
