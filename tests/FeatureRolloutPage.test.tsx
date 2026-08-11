import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/features/feature-rollout/FeatureRolloutPanel', () => ({
  FeatureRolloutPanel: () => <div data-testid="feature-rollout-panel">panel</div>,
}));

import FeatureRolloutPage from '../src/features/feature-rollout/FeatureRolloutPage';

describe('FeatureRolloutPage', () => {
  it('frames runtime rollout in plain Vietnamese language for administrators', () => {
    render(<FeatureRolloutPage />);

    expect(screen.getByRole('heading', { name: 'Tính năng thử nghiệm' })).toBeInTheDocument();
    expect(screen.getByText(/thử nghiệm theo từng nhóm người dùng mà không cần deploy lại/i)).toBeInTheDocument();
    expect(screen.getByTestId('feature-rollout-panel')).toBeInTheDocument();
  });
});
