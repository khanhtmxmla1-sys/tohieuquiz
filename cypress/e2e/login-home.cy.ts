/// <reference types="cypress" />

const installPublicBackend = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/system-settings/feature-flags/resolve*', {
    statusCode: 200,
    body: {
      status: 'success',
      data: { key: 'unified_notifications_v1', enabled: false, reason: 'disabled', version: 1 },
    },
  });
  cy.intercept('GET', '**/api/announcements/current*', {
    statusCode: 200,
    body: { status: 'success', data: { items: [] } },
  });
};

describe('Public home and login flow', () => {
  beforeEach(() => {
    installPublicBackend();
  });

  it('renders the current TôHiệuQuiz login experience and switches roles', () => {
    cy.visit('/');

    cy.contains('TôHiệuQuiz').should('be.visible');
    cy.get('#login-title').should('have.text', 'Chào mừng bạn trở lại').and('be.visible');
    cy.get('[role="group"][aria-label="Chọn vai trò đăng nhập"]').within(() => {
      cy.contains('button', 'Học sinh').should('have.attr', 'aria-pressed', 'true');
      cy.contains('button', 'Giáo viên').click();
    });
    cy.contains('button', 'Giáo viên').should('have.attr', 'aria-pressed', 'true');

    cy.get('#landing-login-username').should('have.attr', 'placeholder', 'Tài khoản giáo viên');
    cy.get('#landing-login-password').should('have.attr', 'type', 'password');
    cy.get('button[aria-label="Hiện mật khẩu"]').click();
    cy.get('#landing-login-password').should('have.attr', 'type', 'text');
    cy.get('button[aria-label="Ẩn mật khẩu"]').should('be.visible');
  });

  it('honors a guarded teacher deep link and restores only teacher account metadata', () => {
    cy.visit('/?login=teacher&returnTo=%2Fteacher%2Fresults', {
      onBeforeLoad(win) {
        win.localStorage.setItem('tohieuquiz_saved_login_v1', JSON.stringify({
          version: 2,
          lastRole: 'student',
          accounts: {
            student: { username: 'student.saved', savedAt: '2026-08-07T00:00:00.000Z' },
            teacher: { username: 'teacher.saved', savedAt: '2026-08-07T00:00:01.000Z' },
          },
        }));
      },
    });

    cy.contains('button', 'Giáo viên').should('have.attr', 'aria-pressed', 'true');
    cy.get('#landing-login-username').should('have.value', 'teacher.saved');
    cy.get('#landing-login-password').should('have.value', '');
    cy.get('input[type="checkbox"]').should('be.checked');

    cy.contains('button', 'Học sinh').click().should('have.attr', 'aria-pressed', 'true');
    cy.get('#landing-login-username').should('have.value', 'student.saved');
    cy.get('#landing-login-password').should('have.value', '');
  });

  it('clears a stale teacher return link when switching roles from a teacher deep link', () => {
    cy.visit('/?login=teacher&returnTo=%2Fteacher%2Foverview');

    cy.contains('button', 'Học sinh').click().should('have.attr', 'aria-pressed', 'true');
    cy.location('search').then((search) => {
      const params = new URLSearchParams(search);
      expect(params.get('login')).to.equal('student');
      expect(params.has('returnTo')).to.equal(false);
    });
    cy.get('#landing-login-username')
      .should('have.attr', 'placeholder', 'Mã học sinh')
      .and('have.value', '');
    cy.get('#landing-login-password').should('have.attr', 'placeholder', 'Mật khẩu học sinh');

    cy.contains('button', 'Giáo viên').click().should('have.attr', 'aria-pressed', 'true');
    cy.location('search').then((search) => {
      const params = new URLSearchParams(search);
      expect(params.get('login')).to.equal('teacher');
      expect(params.has('returnTo')).to.equal(false);
    });
    cy.get('#landing-login-username')
      .should('have.attr', 'placeholder', 'Tài khoản giáo viên')
      .and('have.value', '');
    cy.get('#landing-login-password')
      .should('have.attr', 'type', 'password')
      .and('have.value', '');
  });

  it('clears a stale student return link when switching to the teacher role', () => {
    cy.visit('/?login=student&returnTo=%2Fstudent%2Fdashboard');

    cy.contains('button', 'Giáo viên').click().should('have.attr', 'aria-pressed', 'true');
    cy.location('search').then((search) => {
      const params = new URLSearchParams(search);
      expect(params.get('login')).to.equal('teacher');
      expect(params.has('returnTo')).to.equal(false);
    });
    cy.get('#landing-login-username').should('have.attr', 'placeholder', 'Tài khoản giáo viên');
    cy.get('#landing-login-password').should('have.attr', 'type', 'password');
  });

  it('switches roles without preserving guarded return links in either direction', () => {
    cy.visit('/?login=teacher&returnTo=%2Fteacher%2Foverview');

    cy.contains('button', 'Học sinh').click();
    cy.location('search')
      .should('include', 'login=student')
      .should('not.include', 'returnTo');

    cy.contains('button', 'Giáo viên').click();
    cy.location('search')
      .should('include', 'login=teacher')
      .should('not.include', 'returnTo');

    cy.visit('/?login=student&returnTo=%2Fstudent%2Fdashboard');
    cy.contains('button', 'Giáo viên').click();
    cy.location('search')
      .should('include', 'login=teacher')
      .should('not.include', 'returnTo');
  });

  it('submits the teacher login contract without using live credentials', () => {
    cy.intercept('POST', '**/api/login', (request) => {
      expect(request.body).to.deep.equal({ username: 'teacher.e2e', password: 'wrong-password' });
      request.reply({
        statusCode: 401,
        body: { status: 'error', message: 'Tên đăng nhập hoặc mật khẩu không đúng!' },
      });
    }).as('teacherLogin');

    cy.visit('/?login=teacher');
    cy.get('#landing-login-username').type('teacher.e2e');
    cy.get('#landing-login-password').type('wrong-password');
    cy.contains('button[type="submit"]', 'Đăng nhập').click();

    cy.wait('@teacherLogin').its('response.statusCode').should('eq', 401);
    cy.get('#landing-login-username').should('have.value', 'teacher.e2e');
    cy.contains('button[type="submit"]', 'Đăng nhập').should('be.enabled');
  });
});
