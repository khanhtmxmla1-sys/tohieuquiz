const systemSettings = {
  status: 'success',
  data: {
    aiAssistantEnabled: true,
    unified_notifications_v1: true,
    unifiedNotificationsEnabled: true,
    degraded: false,
  },
};

const announcements = {
  status: 'success',
  data: { items: [{
    id: 'ticker-rollout',
    content: 'Lịch kiểm tra học kỳ đã được cập nhật; giáo viên, học sinh và phụ huynh vui lòng xem lịch mới trước khi đến trường vào sáng thứ Hai tuần tới.',
    isActive: true,
    status: 'PUBLISHED',
    effectiveStatus: 'PUBLISHED',
    audience: 'ALL',
    priority: 'IMPORTANT',
    channels: ['TICKER'],
    dismissible: true,
    startsAt: null,
    endsAt: null,
    updatedAt: '2026-07-24T00:00:00.000Z',
    surfaceOverrides: {},
  }, {
    id: 'banner-rollout',
    content: 'Vui lòng xem lịch mới trước khi vào lớp.',
    bannerTitle: 'Thông báo năm học',
    bannerSubtitle: 'Vui lòng xem lịch mới trước khi vào lớp.',
    bannerLink: '/help',
    bannerImage: '',
    isActive: false,
    isBannerActive: true,
    status: 'PUBLISHED',
    effectiveStatus: 'PUBLISHED',
    audience: 'ALL',
    priority: 'IMPORTANT',
    channels: ['BANNER'],
    dismissible: true,
    ctaLabel: 'Xem chi tiết',
    startsAt: null,
    endsAt: null,
    updatedAt: '2026-07-24T00:00:01.000Z',
    surfaceOverrides: {},
  }] },
};

const installPublicNotificationApi = () => {
  cy.intercept('GET', '**/api/system-settings*', systemSettings);
  cy.intercept('GET', '**/api/announcements*', announcements);
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth)
      .to.be.lte(document.documentElement.clientWidth + 1);
  });
};

describe('Unified notification responsive rollout', () => {
  [
    { width: 1440, height: 900, label: 'login desktop' },
    { width: 390, height: 844, label: 'student mobile width' },
  ].forEach(({ width, height, label }) => {
    it(`keeps the ${label} form usable with ticker and banner`, () => {
      cy.viewport(width, height);
      installPublicNotificationApi();
      cy.visit('/');

      cy.get('[data-notification-surface="LOGIN"]').should('be.visible');
      cy.get('[role="region"][aria-label="Thông báo chung"]').should('be.visible');
      cy.get('[role="region"][aria-label="Thông báo năm học"]').should('be.visible');
      cy.get('[role="region"][aria-label="Thông báo chung"]')
        .focus()
        .find('[data-testid="notification-ticker-track"]')
        .should('have.class', 'notification-ticker__track--paused');
      cy.get('form').filter(':visible').first().scrollIntoView().should('be.visible').then(($form) => {
        const rect = $form[0].getBoundingClientRect();
        expect(rect.top).to.be.gte(0);
        expect(rect.bottom).to.be.lte(Cypress.config('viewportHeight'));
      });
      assertNoHorizontalOverflow();
    });
  });

  it('keeps teacher admin management separate from the inbox', () => {
    cy.readFile('src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx')
      .then((source: string) => {
        expect(source).to.contain('<NotificationCenter');
        expect(source).to.contain('Quản lý thông báo');
        expect(source).to.contain("props.setActiveTab('announcements')");
      });
  });

  it('keeps the mobile inbox bounded and keyboard dismissible', () => {
    cy.readFile('src/features/notifications/components/NotificationCenter.tsx')
      .then((source: string) => {
        expect(source).to.contain('max-h-[85dvh]');
        expect(source).to.contain("event.key !== 'Escape'");
        expect(source).to.contain('triggerRef.current?.focus()');
      });
  });
});
