// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccessibleVirtualList } from '../src/components/common/AccessibleVirtualList';

describe('large collection pagination UI contracts', () => {
  it('virtualizes more than 100 rows while preserving accessible list position metadata', () => {
    const items = Array.from({ length: 150 }, (_, index) => ({ id: `row-${index}`, label: `Item ${index + 1}` }));
    render(
      <AccessibleVirtualList
        items={items}
        getKey={(item) => item.id}
        ariaLabel="Test list"
        itemHeight={40}
        viewportHeight={200}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    const list = screen.getByRole('list', { name: 'Test list' });
    expect(screen.getAllByRole('listitem').length).toBeLessThan(30);
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-setsize', '150');
    fireEvent.scroll(list, { target: { scrollTop: 4000 } });
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-posinset', expect.any(String));
    expect(screen.getByText((_, element) => (
      element?.getAttribute('aria-live') === 'polite'
      && element.textContent?.includes('150') === true
    ))).toBeInTheDocument();
  });
});
