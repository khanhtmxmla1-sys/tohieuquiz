const adminStorage = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'admin.ops',
    teacherName: 'Admin Operations',
    isAdmin: true,
    teacherClass: '',
  },
  version: 0,
});

const teacherStorage = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'teacher.ops',
    teacherName: 'Teacher Operations',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const snapshot = {
  overallStatus: 'degraded',
  checkedAt: '2026-07-29T10:00:00.000Z',
  requestId: 'req-ops-cypress',
  release: 'release-ops-123',
  components: [
    {
      id: 'api', label: 'Worker API', status: 'healthy',
      checkedAt: '2026-07-29T10:00:00.000Z', latencyMs: 8,
      summary: 'Operations endpoint is serving requests.', metrics: [],
    },
    {
      id: 'd1', label: 'D1 database', status: 'degraded',
      checkedAt: '2026-07-29T10:00:00.000Z', latencyMs: 34,
      summary: 'D1 is reachable but latency is elevated.', code: 'D1_LATENCY_HIGH',
      metrics: [{ key: 'latencyMs', value: 34 }],
    },
    {
      id: 'dlq', label: 'Certificate DLQ', status: 'unknown',
      checkedAt: '2026-07-29T10:00:00.000Z', latencyMs: 1,
      summary: 'DLQ depth cannot be observed from this binding.', code: 'DLQ_NOT_OBSERVABLE',
      metrics: [],
    },
  ],
};

const installBaseInterceptors = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
};

describe('Operations Center', () => {
  it('lets an administrator inspect health, runbooks and refresh the snapshot', () => {
    installBaseInterceptors();
    cy.intercept('GET', '**/api/account/me', {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          username: 'admin.ops', fullName: 'Admin Operations', role: 'admin',
          classes: [], mustChangePassword: false,
        },
      },
    }).as('account');
    cy.intercept('GET', '**/api/admin/operations', {
      statusCode: 200,
      body: { status: 'success', data: snapshot },
    }).as('operations');

    cy.visit('/teacher/operations', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth-storage', adminStorage);
      },
    });

    cy.wait('@account');
    cy.wait('@operations');
    cy.contains('h1', 'Operations Center').should('be.visible');
    cy.get('[data-testid="operations-overall-status"]').should('have.attr', 'data-status', 'degraded');
    cy.contains('Request ID: req-ops-cypress').should('be.visible');
    cy.contains('Release: release-ops-123').should('be.visible');
    cy.contains('D1_LATENCY_HIGH').should('be.visible');
    cy.contains('article', 'D1 database').within(() => {
      cy.get('summary').click();
      cy.get('details').should('have.attr', 'open');
      cy.get('ol li').should('have.length', 3);
    });

    cy.get('[data-testid="operations-refresh"]').click();
    cy.wait('@operations');
  });

  it('does not expose the page or menu to a teacher', () => {
    installBaseInterceptors();
    cy.intercept('GET', '**/api/account/me', {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          username: 'teacher.ops', fullName: 'Teacher Operations', role: 'teacher',
          classes: [{ id: 'class-4a', name: '4A' }], mustChangePassword: false,
        },
      },
    }).as('teacherAccount');
    cy.intercept('GET', '**/api/admin/operations', (request) => {
      request.reply({ statusCode: 403, body: { status: 'error', message: 'Forbidden' } });
    }).as('forbiddenOperations');

    cy.visit('/teacher/operations', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth-storage', teacherStorage);
      },
    });

    cy.wait('@teacherAccount');
    cy.location('pathname').should('eq', '/teacher/overview');
    cy.contains('button', 'Operations Center').should('not.exist');
    cy.get('@forbiddenOperations.all').should('have.length', 0);
  });
});
