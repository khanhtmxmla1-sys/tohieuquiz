const TEACHER = 'ai-personal-e2e-teacher';
const CANARY = 'gemini-e2e-canary-key-123456789';

const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: TEACHER,
    teacherName: 'Cô AI Personal',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const dashboardStorageValue = JSON.stringify({ state: { activeTab: 'create' }, version: 2 });
const quizStorageValue = JSON.stringify({
  state: { view: 'teacher_dash', quizzes: [] },
  version: 0,
});

const emptyCredentialState = {
  enabled: true,
  capabilities: {
    text: true,
    documents: false,
    images: false,
    ocr: false,
    webSearch: false,
    imageGeneration: false,
  },
  credentials: [
    {
      provider: 'gemini',
      configured: false,
      last4: null,
      version: 0,
      verifiedAt: null,
      updatedAt: null,
    },
    {
      provider: 'deepseek',
      configured: false,
      last4: null,
      version: 0,
      verifiedAt: null,
      updatedAt: null,
    },
  ],
};

const installSession = (win: Window) => {
  win.localStorage.setItem('auth-storage', authStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_dashboard_ui', dashboardStorageValue);
  win.localStorage.setItem('tohieuquiz-store', quizStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_restore_hint', '1');
};

const installBootstrap = (credentialState = emptyCredentialState) => {
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: TEACHER,
        fullName: 'Cô AI Personal',
        role: 'teacher',
        classes: [{ id: 'class-4a', name: '4A' }],
        mustChangePassword: false,
      },
    },
  });
  cy.intercept('GET', '**/api/account/ai-credentials', {
    statusCode: 200,
    body: credentialState,
  }).as('credentialState');
  cy.intercept('GET', '**/api/teacher-ai-quota', {
    statusCode: 200,
    body: {
      status: 'success',
      data: {
        username: TEACHER,
        role: 'teacher',
        usageDate: '2026-09-25',
        dailyLimit: 5,
        usedCount: 0,
        remaining: 5,
        canGenerate: true,
        unlimited: false,
      },
    },
  });
  cy.intercept('GET', '**/api/classes*', { statusCode: 200, body: { status: 'success', data: [] } });
  cy.intercept('GET', '**/api/quizzes*', { statusCode: 200, body: { status: 'success', data: [] } });
  cy.intercept('GET', '**/api/results*', { statusCode: 200, body: { status: 'success', data: [] } });
};

describe('Teacher personal AI keys', () => {
  it('saves a key once and sends only the personal source to /api/ai/chat', () => {
    installBootstrap();

    cy.intercept('PUT', '**/api/account/ai-credentials/gemini', (request) => {
      expect(request.body).to.deep.equal({
        apiKey: CANARY,
        expectedVersion: 0,
      });
      request.reply({
        statusCode: 200,
        body: {
          credential: {
            provider: 'gemini',
            configured: true,
            last4: '6789',
            version: 1,
            verifiedAt: '2026-09-25T06:00:00.000Z',
            updatedAt: '2026-09-25T06:00:00.000Z',
          },
        },
      });
    }).as('saveGemini');

    cy.intercept('POST', '**/api/ai/chat', (request) => {
      const serialized = JSON.stringify(request.body);
      expect(request.body.source).to.equal('gemini-personal');
      expect(serialized).not.to.contain(CANARY);
      expect(serialized).not.to.contain('apiKey');
      request.reply({
        statusCode: 503,
        body: { code: 'AI_PROVIDER_UNAVAILABLE', message: 'E2E stubbed provider.' },
      });
    }).as('personalAi');

    cy.visit('/teacher/quizzes?mode=create', { onBeforeLoad: installSession });
    cy.get('h2', { timeout: 15_000 }).contains('Tạo đề bằng AI').should('be.visible');
    cy.wait('@credentialState');

    cy.contains('button', 'Tùy chọn nâng cao').click();
    cy.contains('button', 'Gemini cá nhân').click().should('have.attr', 'aria-pressed', 'true');

    cy.contains('label', 'API key Gemini').find('input')
      .should('have.attr', 'type', 'password')
      .type(CANARY);
    cy.contains('button', 'Kiểm tra và lưu').click();
    cy.wait('@saveGemini');

    cy.contains('label', 'API key Gemini').should('not.exist');
    cy.contains('Gemini cá nhân — Đã lưu ••••6789').should('be.visible');
    cy.window().then((win) => {
      Object.keys(win.localStorage).forEach((key) => {
        expect(win.localStorage.getItem(key) || '').not.to.contain(CANARY);
      });
      Object.keys(win.sessionStorage).forEach((key) => {
        expect(win.sessionStorage.getItem(key) || '').not.to.contain(CANARY);
      });
    });

    cy.get('input[placeholder*="Động vật rừng xanh"]').clear().type('Phân số lớp 4');
    cy.contains('button', '📚 Ra đề ÔN TẬP').should('be.enabled').click();
    cy.wait('@personalAi').its('request.body._meta.stage').should('equal', 'GENERATE');
  });

  it('renders saved metadata on a mobile viewport without exposing plaintext', () => {
    cy.viewport(390, 844);
    installBootstrap({
      ...emptyCredentialState,
      credentials: [
        {
          provider: 'gemini',
          configured: true,
          last4: 'a1B2',
          version: 3,
          verifiedAt: '2026-09-25T06:00:00.000Z',
          updatedAt: '2026-09-25T06:00:00.000Z',
        },
        emptyCredentialState.credentials[1],
      ],
    });

    cy.visit('/teacher/quizzes?mode=create', { onBeforeLoad: installSession });
    cy.get('h2', { timeout: 15_000 }).contains('Tạo đề bằng AI').should('be.visible');
    cy.wait('@credentialState');
    cy.contains('button', 'Tùy chọn nâng cao').click();
    cy.contains('button', 'Gemini cá nhân').click();

    cy.contains('Gemini cá nhân — Đã lưu ••••a1B2').should('be.visible');
    cy.contains('button', 'Kiểm tra lại').should('be.visible');
    cy.contains('button', 'Thay key').should('be.visible');
    cy.contains('button', 'Xóa khỏi TôHiệuQuiz').should('be.visible');
    cy.get('body').should('not.contain', CANARY);
  });
});
