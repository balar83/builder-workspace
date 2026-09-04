import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import RemediationPanel from '../../src/components/RemediationPanel';

describe('RemediationPanel', () => {
  it('renders the authored why/remediationHint content when supplied', () => {
    render(
      <RemediationPanel
        why="Students often mix up the sign."
        remediationHint="Check the sign before combining terms."
      />,
    );

    expect(screen.getByText('Students often mix up the sign.')).toBeInTheDocument();
    expect(screen.getByText('Check the sign before combining terms.')).toBeInTheDocument();
  });
});
