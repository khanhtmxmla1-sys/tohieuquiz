const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'teacher.security',
    teacherName: 'Giáo viên Bảo mật',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const currentSession = {
  id: 'session-current',
  current: true,
  userAgentFamily: 'Chrome',
  createdAt: '2026-07-29T08:00:00.000Z',
  lastSeenAt: '2026-07-29T09:00:00.000Z',
  expiresAt: '2026-08-05T08:00:00.000Z',
};

const otherSession = {
  id: 'session-firefox',
  current: false,
  userAgentFamily: 'Firefox',
  createdAt: '2026-07-28T08:00:00.000Z',
  lastSeenAt: '2026-07-28T09:00:00.000Z',
  expiresAt: '2026-08-04T08:00:00.000Z',
};

describe('Security Center session management', () => {
  it('shows privacy-minimal sessions and revokes another device', () => {
    let sessions = [currentSession, otherSession];
    const events = [{
      id: 'event-password',
      eventType: 'PASSWORD_CHANGED',
      severity: 'informational',
      actorUsername: 'teacher.security',
      sessionId: 'session-current',
      createdAt: '2026-07-29T07:00:00.000Z',
      metadata: {},
    }];

    cy.intercept({ method: 'GET', pathname: '/api/**' }, {
      statusCode: 200,
      body: { status: 'success', data: [] },
    });
    cy.intercept('GET', '**/api/account/me', {
      statusCode: 200,
      body: {
        data: {
          username: 'teacher.security',
          fullName: 'Giáo viên Bảo mật',
          role: 'teacher',
          status: 'ACTIVE',
          lastLoginAt: '2026-07-29T08:00:00.000Z',
          classes: [{ id: 'class-4a', name: '4A' }],
          mustChangePassword: false,
        },
      },
    }).as('accountProfile');
    cy.intercept({ method: 'GET', pathname: '/api/account/sessions' }, (request) => {
      request.reply({ statusCode: 200, body: { status: 'success', data: sessions } });
    }).as('accountSessions');
    cy.intercept({ method: 'GET', pathname: '/api/account/security-events' }, {
      statusCode: 200,
      body: { status: 'success', data: events },
    }).as('securityEvents');
    cy.intercept({ method: 'POST', pathname: '/api/account/sessions/session-firefox/revoke' }, (request) => {
      expect(request.body).to.deep.equal({});
      sessions = [currentSession];
      request.reply({ statusCode: 200, body: { status: 'success' } });
    }).as('revokeFirefox');

    cy.visit('/teacher/settings', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth-storage', authStorageValue);
      },
    });

    cy.wait('@accountProfile');
    cy.wait('@accountSessions');
    cy.wait('@securityEvents');
    cy.contains('h3', 'Phiên đăng nhập', { timeout: 20_000 }).should('be.visible');
    cy.contains('Chrome').parent().should('contain.text', 'Phiên hiện tại');
    cy.contains('Firefox').should('be.visible');
    cy.contains('Đã đổi mật khẩu').should('be.visible');
    cy.get('body').should('not.contain.text', '192.168.');

    cy.contains('Firefox').closest('article').within(() => {
      cy.contains('button', 'Thu hồi').click();
    });
    cy.wait('@revokeFirefox');
    cy.contains('Firefox').should('not.exist');
    cy.contains('Chrome').should('be.visible');
  });
});
