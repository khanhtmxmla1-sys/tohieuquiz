const TEACHER = 'quiz-entry-e2e-teacher';

const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: TEACHER,
    teacherName: 'Cô E2E',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const installSession = (win: Window) => {
  win.localStorage.setItem('auth-storage', authStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_restore_hint', '1');
};

const stubBackend = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: TEACHER,
        fullName: 'Cô E2E',
        role: 'teacher',
        classes: [{ id: 'class-4a', name: '4A' }],
        mustChangePassword: false,
      },
    },
  }).as('accountProfile');
  cy.intercept('GET', '**/api/results/summary', {
    statusCode: 200,
    body: {
      status: 'success',
      data: {
        totalSubmissions: 0,
        uniqueCompletedWorks: 0,
        todaySubmissions: 0,
        uniqueStudents: 0,
        attemptPolicy: 'latest',
        timezone: 'Asia/Ho_Chi_Minh',
        statistics: {
          totalResults: 0,
          mean: 0,
          median: 0,
          stdDev: 0,
          min: 0,
          max: 0,
          passRate: 0,
          passCount: 0,
          failCount: 0,
          scoreDistribution: [],
        },
      },
    },
  });
  cy.intercept('GET', '**/api/teacher/action-center', {
    statusCode: 200,
    body: {
      status: 'success',
      data: { generatedAt: new Date().toISOString(), items: [] },
    },
  });
  cy.intercept('GET', '**/api/system-settings*', {
    statusCode: 200,
    body: {
      status: 'success',
      data: { aiAssistantEnabled: true, unifiedNotificationsEnabled: false },
    },
  });
};

const visitOverview = (width = 1280, height = 800) => {
  cy.viewport(width, height);
  cy.visit('/teacher/overview', { onBeforeLoad: installSession });
  cy.wait('@accountProfile');
  cy.location('pathname').should('eq', '/teacher/overview');
  cy.contains('h2', 'Tạo đề kiểm tra', { timeout: 20_000 }).should('be.visible');
};

const expectAiRoute = () => {
  cy.location('pathname').should('eq', '/teacher/quizzes');
  cy.location('search').should('contain', 'mode=create');
  cy.contains('h2', 'Tạo đề bằng AI', { timeout: 20_000 }).should('be.visible');
  cy.contains('button', /Mở phòng soạn đề thủ công/i).should('not.exist');
};

describe('quiz creation entry points', () => {
  beforeEach(() => {
    stubBackend();
  });

  it('opens the AI creator from the desktop sidebar without changing its canonical route', () => {
    visitOverview();

    cy.get('aside').contains('button', 'Tạo đề bằng AI').click();

    expectAiRoute();
  });

  it('opens a fresh manual workspace with the teacher class and supports browser Back', () => {
    visitOverview();

    cy.get('aside').contains('button', 'Soạn đề thủ công').click();

    cy.location('pathname').should('eq', '/teacher/quizzes/new');
    cy.get('[data-testid="manual-quiz-workspace"]', { timeout: 20_000 }).should('be.visible');
    cy.get('#manual-quiz-title').should('have.value', 'Đề kiểm tra mới');

    cy.go('back');
    cy.location('pathname').should('eq', '/teacher/overview');
  });

  it('keeps both choices available in the overview panel and recent quizzes', () => {
    visitOverview();

    cy.contains('h2', 'Tạo đề kiểm tra').closest('section').within(() => {
      cy.contains('button', 'Tạo đề bằng AI').should('be.visible');
      cy.contains('button', 'Soạn đề thủ công').should('be.visible');
    });

    cy.contains('h2', 'Đề kiểm tra gần đây').closest('section').within(() => {
      cy.contains('button', 'Tạo đề bằng AI').should('be.visible');
      cy.contains('button', 'Soạn đề thủ công').should('be.visible');
    });
  });

  it('opens the mobile drawer, closes it through navigation, and reaches the AI creator', () => {
    visitOverview(390, 844);

    cy.window().its('innerWidth').should('eq', 390);
    cy.get('button[aria-label="Mở menu điều hướng"]').click();
    cy.get('aside').should('be.visible');
    cy.get('aside').contains('button', 'Tạo đề bằng AI').click();

    expectAiRoute();
  });
});
