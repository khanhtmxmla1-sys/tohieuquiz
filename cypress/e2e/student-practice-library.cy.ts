const VIEWPORTS = [
  { width: 375, height: 812, label: '375x812' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 1440, height: 900, label: '1440x900' },
] as const;

let studentCredentials = { username: '', password: '' };

const loadStudentCredentials = () =>
  cy
    .env<{ studentUsername?: string; studentPassword?: string }>([
      'studentUsername',
      'studentPassword',
    ])
    .then(({ studentUsername, studentPassword }) => {
      studentCredentials = {
        username: String(studentUsername || ''),
        password: String(studentPassword || ''),
      };

      expect(
        studentCredentials.username,
        'studentUsername is required. Run with --env studentUsername=...,studentPassword=...',
      ).to.not.equal('');
      expect(
        studentCredentials.password,
        'studentPassword is required. Run with --env studentUsername=...,studentPassword=...',
      ).to.not.equal('');
    });

const loginAsStudent = () => {
  cy.visit('/');
  cy.contains('button', 'Học sinh').click();
  cy.get('input[type="text"]').first().clear().type(studentCredentials.username, { log: false });
  cy.get('input[type="password"]').first().clear().type(studentCredentials.password, { log: false });
  cy.contains('button', 'Đăng nhập ngay').click();
  cy.get('.student-dashboard', { timeout: 20_000 }).should('be.visible');
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    const root = document.documentElement;
    expect(root.scrollWidth, 'document scrollWidth').to.be.lte(root.clientWidth + 1);
  });
};

const openFirstAvailableSubject = () => {
  cy.get('#practice-library').scrollIntoView().should('be.visible');
  cy.get('[data-testid="subject-practice-grid"] button').first().as('firstSubject');
  cy.get('@firstSubject').find('span.text-lg').invoke('text').as('subjectTitle');
  cy.get('@firstSubject').click();
  cy.location('pathname', { timeout: 15_000 }).should(
    'match',
    /^\/student\/practice\/(toan|tieng-viet|tu-nhien-xa-hoi|tieng-anh|tin-hoc)$/,
  );
  cy.get('@subjectTitle').then((title) => {
    cy.contains('h1', String(title).trim()).should('be.visible');
  });
  cy.get('input[type="search"][aria-label="Tìm chuyên đề"], input#practice-topic-search')
    .should('be.visible');
};

describe('Authenticated student practice library flow', () => {
  before(() => {
    loadStudentCredentials();
  });

  it('returns to the dashboard with browser Back from a canonical subject route', () => {
    loginAsStudent();
    openFirstAvailableSubject();

    cy.go('back');
    cy.location('pathname').should('equal', '/');
    cy.get('#practice-library').should('be.visible');
  });

  it('keeps a canonical direct subject route across reload', () => {
    loginAsStudent();
    openFirstAvailableSubject();

    cy.location('pathname').then((pathname) => {
      const subjectPath = String(pathname);
      cy.reload();
      cy.location('pathname').should('equal', subjectPath);
      cy.get('h1').should('be.visible');

      cy.visit('/');
      cy.visit(subjectPath);
      cy.location('pathname').should('equal', subjectPath);
      cy.get('h1').should('be.visible');
    });
  });

  it('filters topics and distinguishes a search-empty state', () => {
    loginAsStudent();
    openFirstAvailableSubject();

    cy.contains('button', 'Luyện 10 câu').first().as('firstTopic');
    cy.get('@firstTopic').find('span.text-xl').invoke('text').then((topicTitle) => {
      cy.get('input#practice-topic-search').clear().type(String(topicTitle).trim());
      cy.contains('button', 'Luyện 10 câu').should('have.length.at.least', 1);
    });

    cy.get('input#practice-topic-search').clear().type('khong-co-chuyen-de-nay-987654');
    cy.contains('Không tìm thấy chuyên đề phù hợp.').should('be.visible');
  });

  it('shows local topic loading before entering the quiz player', () => {
    loginAsStudent();
    openFirstAvailableSubject();

    cy.intercept('**', (request) => {
      const requestBody = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body || {});
      if (request.url.includes('practice') || requestBody.includes('get_practice_quiz')) {
        request.continue((response) => response.setDelay(800));
      }
    });

    cy.contains('button', 'Luyện 10 câu').first().as('startingTopic').click();
    cy.get('@startingTopic').should('have.attr', 'aria-busy', 'true').and('be.disabled');

    cy.get('body', { timeout: 20_000 }).should(($body) => {
      const hasQuizQuestions = $body.find('[aria-label^="Câu "]').length > 0;
      const hasStudentStart = $body.text().includes('Bắt đầu làm bài!');
      expect(hasQuizQuestions || hasStudentStart, 'quiz player is visible').to.equal(true);
    });
  });

  VIEWPORTS.forEach(({ width, height, label }) => {
    it(`has no horizontal overflow on the subject page at ${label}`, () => {
      cy.viewport(width, height);
      loginAsStudent();
      openFirstAvailableSubject();
      assertNoHorizontalOverflow();
      cy.get('header button[aria-label="Trở về thư viện"]').should('have.css', 'min-height', '44px');
      cy.contains('button', 'Luyện 10 câu').first().should('be.visible');
    });
  });
});
