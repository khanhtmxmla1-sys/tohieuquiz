const teacherProfile = {
  status: 'success',
  data: {
    username: 'teacher.route',
    fullName: 'Giáo viên Route',
    role: 'teacher',
    teacherClass: '4A',
  },
};

const stubTeacherSession = (delay = 0) => {
  cy.intercept('GET', '**/api/account/me', (request) => {
    request.reply({
      delay,
      statusCode: 200,
      body: teacherProfile,
    });
  }).as('teacherSession');
};

describe('URL-first dashboard navigation', () => {
  it('waits for session restore and preserves a teacher results deep link', () => {
    stubTeacherSession(300);

    cy.visit('/teacher/results?page=2&q=An');
    cy.get('[data-testid="route-session-loading"]')
      .should('be.visible')
      .and('contain.text', 'Đang khôi phục phiên đăng nhập');

    cy.wait('@teacherSession');
    cy.location('pathname').should('eq', '/teacher/results');
    cy.location('search').should('contain', 'page=2').and('contain', 'q=An');
    cy.contains('button', 'Học sinh', { timeout: 20_000 }).click();
    cy.contains('button', 'Lớp học').click();
    cy.location('pathname').should('eq', '/teacher/classes');

    cy.go('back');
    cy.location('pathname').should('eq', '/teacher/results');
    cy.location('search').should('contain', 'page=2').and('contain', 'q=An');
  });

  it('redirects an anonymous deep link with an allowlisted returnTo', () => {
    cy.intercept('GET', '**/api/account/me', {
      statusCode: 401,
      body: { status: 'error', message: 'Unauthorized' },
    }).as('anonymousTeacher');

    cy.visit('/teacher/classes');
    cy.wait('@anonymousTeacher');
    cy.location('pathname').should('eq', '/');
    cy.location('search').then((search) => {
      const params = new URLSearchParams(search);
      expect(params.get('login')).to.eq('teacher');
      expect(params.get('returnTo')).to.eq('/teacher/classes');
    });
    cy.contains('button', 'Giáo viên', { timeout: 20_000 })
      .should('be.visible')
      .and('have.class', 'bg-white');
  });
});
