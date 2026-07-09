import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DifficultyBadge from '../../src/components/DifficultyBadge';

describe('DifficultyBadge', () => {
  it('renders level text and style', () => {
    render(<DifficultyBadge level="Easy" />);
    expect(screen.getByText('Easy')).toBeDefined();
  });
});
