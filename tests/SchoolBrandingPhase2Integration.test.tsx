// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DashboardNavbar } from '../src/components/HomePage/components/DashboardNavbar';
import Footer from '../src/components/common/Footer';
import PublicPageHeader from '../src/components/schoolPage/PublicPageHeader';
import {
  ParentPortalFallback,
  ParentPortalLayout,
} from '../src/features/parent-portal/layout/ParentPortalLayout';
import ParentLoginPage from '../src/features/parent-portal/pages/ParentLoginPage';
import { SCHOOL_LOGO_URL } from '../src/config/branding';

const expectSchoolLogoCount = (container: HTMLElement, count = 1) => {
  expect(container.querySelectorAll(`img[src="${SCHOOL_LOGO_URL}"]`)).toHaveLength(count);
};

const renderInRouter = (node: React.ReactNode) => render(
  <MemoryRouter>{node}</MemoryRouter>,
);

describe('school logo phase 2 integration', () => {
  it('uses the school logo in the alternate dashboard navbar', () => {
    const { container } = render(
      <DashboardNavbar
        isLoggedIn={false}
        isTeacherLoggedIn={false}
        onResetHome={vi.fn()}
        onOpenLogin={vi.fn()}
        onActionCta={vi.fn()}
      />,
    );

    expectSchoolLogoCount(container);
  });

  it('uses the school logo in the public page header', () => {
    const { container } = renderInRouter(<PublicPageHeader activePage="about" />);

    expectSchoolLogoCount(container);
  });

  it('uses the school logo in both footer variants', () => {
    const compact = render(<Footer onNavigate={vi.fn()} showPublicLinks={false} />);
    const full = render(<Footer onNavigate={vi.fn()} />);

    expectSchoolLogoCount(compact.container);
    expectSchoolLogoCount(full.container);
  });

  it('uses the school logo in the authenticated parent portal header', () => {
    const { container } = renderInRouter(
      <ParentPortalLayout>
        <div>Nội dung cổng phụ huynh</div>
      </ParentPortalLayout>,
    );

    expectSchoolLogoCount(container);
  });

  it('uses the school logo in the parent portal loading fallback', () => {
    const { container } = render(<ParentPortalFallback />);

    expectSchoolLogoCount(container);
  });

  it('uses the school logo in the parent login header', () => {
    const { container } = renderInRouter(<ParentLoginPage />);

    expectSchoolLogoCount(container);
  });
});
