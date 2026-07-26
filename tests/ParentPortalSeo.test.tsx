import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/features/parent-portal/useParentPortalStore', () => ({
  useParentPortalStore: (selector: (state: any) => unknown) => selector({
    session: null,
    restoreSession: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../src/features/parent-portal/pages/ParentActivatePage', () => ({ default: () => <div>activate</div> }));
vi.mock('../src/features/parent-portal/pages/ParentLoginPage', () => ({ default: () => <div>login</div> }));
vi.mock('../src/features/parent-portal/layout/ParentPortalLayout', () => ({
  ParentPortalFallback: () => <div>loading</div>,
  ParentPortalLayout: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

import ParentPortalApp from '../src/features/parent-portal/ParentPortalApp';

describe('Parent Portal SEO isolation', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta[name="robots"],meta[name="referrer"]').forEach(node => node.remove());
    document.title = 'Main site';
  });

  it('sets private portal metadata without leaking it after unmount', async () => {
    const view = render(<MemoryRouter initialEntries={['/login']}><ParentPortalApp /></MemoryRouter>);
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow'));
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
    expect(document.title).toBe('Cổng phụ huynh - TôHiệuQuiz');

    view.unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.querySelector('meta[name="referrer"]')).toBeNull();
    expect(document.title).toBe('Main site');
  });
});
