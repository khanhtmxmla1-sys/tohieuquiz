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

describe('runtime feature rollout control plane', () => {
  it('patches one field with a reason and rolls it back without a deploy', () => {
    let flag = { ...baseFlag };

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
    }).as('announcements');
    cy.intercept({ method: 'GET', pathname: '/api/system-settings/feature-flags' }, (request) => {
      request.reply({ statusCode: 200, body: { status: 'success', data: [flag] } });
    }).as('featureFlags');
    cy.intercept({ method: 'GET', pathname: '/api/system-settings/feature-flags/resolve' }, {
      statusCode: 200,
      body: { status: 'success', data: { key: 'unified_notifications_v1', enabled: true, reason: 'percentage', bucket: 1, version: 1 } },
    }).as('resolveFlag');
    cy.intercept({ method: 'PATCH', pathname: '/api/system-settings/feature-flags/unified_notifications_v1' }, (request) => {
      expect(request.body).to.deep.equal({
        field: 'percentage', value: 25, reason: 'Pilot 25 percent',
      });
      flag = { ...flag, percentage: 25, version: 2, updatedBy: 'admin.rollout', reason: 'Pilot 25 percent' };
      request.reply({ statusCode: 200, body: { status: 'success', data: flag } });
    }).as('patchFlag');
    cy.intercept({ method: 'POST', pathname: '/api/system-settings/feature-flags/unified_notifications_v1/rollback' }, (request) => {
      expect(request.body).to.deep.equal({ reason: 'Stop condition breached' });
      flag = { ...flag, percentage: 5, version: 3, updatedBy: 'admin.rollout', reason: 'Stop condition breached' };
      request.reply({ statusCode: 200, body: { status: 'success', data: flag } });
    }).as('rollbackFlag');

    cy.visit('/teacher/announcements', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth-storage', adminStorage);
      },
    });

    cy.wait('@account');
    cy.wait('@featureFlags');
    cy.contains('h3', 'Feature rollout', { timeout: 20_000 }).should('be.visible');
    cy.contains('Preview cohort:').parent().should('contain.text', 'teacher, 5%');

    cy.contains('section', 'Feature rollout').within(() => {
      cy.get('select').first().should('have.value', 'percentage');
      cy.get('[data-testid="rollout-value"]').clear().type('25');
      cy.get('[data-testid="rollout-reason"]').type('Pilot 25 percent');
      cy.get('[data-testid="rollout-save"]').click();
    });
    cy.wait('@patchFlag');
    cy.contains('section', 'Feature rollout').should('contain.text', 'teacher, 25%');

    cy.contains('section', 'Feature rollout').within(() => {
      cy.get('[data-testid="rollout-reason"]').type('Stop condition breached');
      cy.get('[data-testid="rollout-rollback"]').click();
    });
    cy.wait('@rollbackFlag');
    cy.contains('section', 'Feature rollout').should('contain.text', 'teacher, 5%');
  });
});
