import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HeroSection from '../src/components/HomePage/components/HeroSection';

describe('login hero feature icons', () => {
  it('uses the approved icon set for both login roles', () => {
    const { container } = render(<HeroSection />);
    const icons = Array.from(container.querySelectorAll('[data-login-feature-icon]'));

    expect(icons).toHaveLength(3);
    expect(icons.map((icon) => icon.getAttribute('data-login-feature-icon'))).toEqual([
      'exam-management',
      'learning-analytics',
      'daily-practice',
    ]);
    icons.forEach((icon) => expect(icon).toHaveAttribute('aria-hidden', 'true'));
  });
});
