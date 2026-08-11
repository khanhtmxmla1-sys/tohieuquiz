const adminStorage = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'admin.rollout',
    teacherName: 'Rollout Admin',
    isAdmin: true,
    teacherClass: '',
  },
  version: 0,
});

const baseFlag = {
  key: 'unified_notifications_v1',
  description: 'Unified notifications',
  enabled: true,
  audience: 'teacher',
  percentage: 5,
  allowUsers: [],
  allowClasses: ['class-4a'],
  startsAt: null,
  endsAt: null,
  owner: 'platform',
  reason: 'pilot',
  stopConditions: {
    max5xxRatePercent: 1,
    maxClientErrorMultiplier: 2,
    maxP95IncreasePercent: 30,
  },
  version: 1,
  updatedBy: 'migration-0054',
  updatedAt: '2026-07-29T10:00:00.000Z',
};

const visitAsAdmin = (path: string) => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', adminStorage);
    },
  });
};

describe('runtime feature rollout route separation', () => {
  it('keeps rollout off the announcement page and loads it only on the dedicated admin route', () => {
    let featureFlagRequests = 0;

    cy.intercept({ method: 'GET', pathname: '/api/**' }, {
      statusCode: 200,
      body: { status: 'success', data: [] },
    });
    cy.intercept('GET', '**/api/account/me', {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          username: 'admin.rollout', fullName: 'Rollout Admin', role: 'admin',
          classes: [], mustChangePassword: false,
        },
      },
    }).as('account');
    cy.intercept({ method: 'GET', pathname: '/api/announcements/current' }, {
      statusCode: 200,
      body: { status: 'success', data: { items: [] } },
    });
    cy.intercept({ method: 'GET', pathname: '/api/admin/announcements' }, {
      statusCode: 200,
      body: { status: 'success', data: [] },
    }).as('announcementList');
    cy.intercept({ method: 'GET', pathname: '/api/system-settings/feature-flags' }, (request) => {
      featureFlagRequests += 1;
      request.reply({ statusCode: 200, body: { status: 'success', data: [baseFlag] } });
    }).as('featureFlags');

    visitAsAdmin('/teacher/announcements');
    cy.wait('@account');
    cy.wait('@announcementList');
    cy.contains('h2', 'Quản lý thông báo', { timeout: 20_000 }).should('be.visible');
    cy.contains('Feature rollout').should('not.exist');
    cy.then(() => expect(featureFlagRequests).to.equal(0));

    visitAsAdmin('/teacher/feature-rollout');
    cy.wait('@account');
    cy.wait('@featureFlags');
    cy.contains('h2', 'Tính năng thử nghiệm', { timeout: 20_000 }).should('be.visible');
    cy.contains('button', 'Thông báo hợp nhất').should('be.visible');
    cy.then(() => expect(featureFlagRequests).to.be.greaterThan(0));
  });
});
