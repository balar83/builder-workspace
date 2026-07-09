import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProgressBar from '../../src/components/ProgressBar';

describe('ProgressBar', () => {
  it('applies width based on percent', () => {
    const { container } = render(<ProgressBar percent={50} />);
    const inner = container.querySelector('.progress-inner') as HTMLElement;
    expect(inner).toBeDefined();
    expect(inner.style.width).toBe('50%');
  });
});
