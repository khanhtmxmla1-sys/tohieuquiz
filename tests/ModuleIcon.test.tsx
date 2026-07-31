import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModuleIcon, MODULE_ICON_CATALOG } from '../src/components/common/module-icon';

describe('ModuleIcon', () => {
  it('exports the exact module icon catalog', () => {
    expect(Object.keys(MODULE_ICON_CATALOG)).toEqual(['question-bank','students','achievements','analytics-report','learning-resources','store','competition','tasks','system-settings']);
    expect(new Set(Object.values(MODULE_ICON_CATALOG).map(item => item.src)).size).toBe(9);
  });
  it('renders decorative icons with fixed dimensions', () => {
    const { container } = render(<ModuleIcon name="students" size="md" />);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('width', '48'); expect(image).toHaveAttribute('height', '48'); expect(image).toHaveAttribute('alt', ''); expect(image).toHaveAttribute('aria-hidden', 'true');
  });
  it('uses the Vietnamese catalog label when informative', () => {
    render(<ModuleIcon name="students" decorative={false} />);
    expect(screen.getByRole('img', { name: 'Học sinh' })).toBeInTheDocument();
  });
});
