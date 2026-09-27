const TEACHER = 'server-quiz-e2e-teacher';

const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: TEACHER,
    teacherName: 'Cô Server Quiz',
    isAdmin: false,
    teacherClass: '3A',
  },
  version: 0,
});

const dashboardStorageValue = JSON.stringify({
  state: { activeTab: 'create' },
  version: 2,
});

const quizStorageValue = JSON.stringify({
  state: { view: 'teacher_dash', quizzes: [] },
  version: 0,
});

type QuizSource = 'system' | 'gemini-personal' | 'deepseek-personal';

interface VisitOptions {
  source?: QuizSource;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
  delayMs?: number;
}

const serverQuiz = {
  promptVersion: 'ai-blueprint-v3',
  blueprintVersion: 3,
  title: 'Đề phép nhân lớp 3',
  detectedCategory: 'toan',
  detectedLesson: 'Phép nhân',
  suggestedTags: ['phep_nhan', 'lop_3'],
  timeLimit: 15,
  questions: [
    {
      slotId: 'slot-1',
      type: 'MCQ',
      difficulty: 1,
      diagramPolicy: 'forbidden',
      question: 'Kết quả của 3 nhân 4 là bao nhiêu?',
      options: ['12', '7', '9', '14'],
      correctAnswer: 'A',
    },
    {
      slotId: 'slot-2',
      type: 'MCQ',
      difficulty: 2,
      diagramPolicy: 'forbidden',
      question: 'Có 4 nhóm, mỗi nhóm 5 que tính. Có tất cả bao nhiêu que tính?',
      options: ['9', '20', '25', '15'],
      correctAnswer: 'B',
    },
  ],
};

const installSession = (win: Window) => {
  win.localStorage.setItem('auth-storage', authStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_dashboard_ui', dashboardStorageValue);
  win.localStorage.setItem('tohieuquiz-store', quizStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_restore_hint', '1');
};

const credentialStateFor = (source: Exclude<QuizSource, 'system'>) => ({
  status: 'success',
  enabled: true,
  defaultSource: source,
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
      configured: source === 'gemini-personal',
      last4: source === 'gemini-personal' ? '6789' : null,
      version: source === 'gemini-personal' ? 1 : 0,
      verifiedAt: source === 'gemini-personal' ? '2026-09-27T00:00:00.000Z' : null,
      updatedAt: source === 'gemini-personal' ? '2026-09-27T00:00:00.000Z' : null,
    },
    {
      provider: 'deepseek',
      configured: source === 'deepseek-personal',
      last4: source === 'deepseek-personal' ? '2468' : null,
      version: source === 'deepseek-personal' ? 1 : 0,
      verifiedAt: source === 'deepseek-personal' ? '2026-09-27T00:00:00.000Z' : null,
      updatedAt: source === 'deepseek-personal' ? '2026-09-27T00:00:00.000Z' : null,
    },
  ],
});

const interceptBootstrap = () => {
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: TEACHER,
        fullName: 'Cô Server Quiz',
        role: 'teacher',
        classes: [{ id: 'class-3a', name: '3A' }],
        mustChangePassword: false,
      },
    },
  });

  cy.intercept('GET', '**/api/teacher-ai-quota', {
    statusCode: 200,
    body: {
      status: 'success',
      data: {
        username: TEACHER,
        role: 'teacher',
        usageDate: '2026-09-27',
        dailyLimit: 5,
        usedCount: 0,
        remaining: 5,
        canGenerate: true,
        unlimited: false,
      },
    },
  });

  cy.intercept('GET', '**/api/classes*', {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/quizzes*', {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/results*', {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });

  cy.intercept('GET', '**/api/system-settings/feature-flags/resolve*', (request) => {
    const flag = String(request.query.flag || '');
    request.alias = flag === 'server_quiz_generation_v1'
      ? 'serverQuizFlag'
      : 'otherFeatureFlag';
    request.reply({
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          key: flag,
          enabled: flag === 'server_quiz_generation_v1' || flag === 'ai_assistant_enabled',
          version: 1,
        },
      },
    });
  });
};

const visitCreateTab = (options: VisitOptions = {}) => {
  const source = options.source ?? 'system';
  interceptBootstrap();

  if (source !== 'system') {
    cy.intercept('GET', '**/api/account/ai-credentials', {
      statusCode: 200,
      body: credentialStateFor(source),
    }).as('credentialState');
  }

  cy.intercept('POST', '**/api/ai/chat', {
    statusCode: 500,
    body: { status: 'error', message: 'Legacy chat path must not be called.' },
  }).as('legacyChat');

  cy.intercept('POST', '**/api/ai/quiz/generate', (request) => {
    expect(request.body.source).to.equal(source);
    expect(request.body.sourceMode).to.equal('TOPIC');
    expect(request.body.model).to.be.undefined;
    expect(request.body.messages).to.be.undefined;
    expect(request.body.apiKey).to.be.undefined;
    expect(request.body.prompt).to.be.undefined;

    if (source !== 'system') {
      const serialized = JSON.stringify(request.body);
      expect(serialized).not.to.contain('gemini-e2e-canary-key-123456789');
      expect(serialized).not.to.contain('deepseek-e2e-canary-key-123456789');
    }

    const statusCode = options.statusCode ?? 200;
    if (statusCode !== 200) {
      request.reply({
        statusCode,
        body: {
          status: 'error',
          code: options.errorCode ?? 'AI_PROVIDER_UNAVAILABLE',
          message: options.errorMessage ?? 'Nhà cung cấp AI tạm thời không khả dụng.',
        },
      });
      return;
    }

    request.reply({
      statusCode: 200,
      delay: options.delayMs,
      body: {
        status: 'success',
        actionId: request.body.actionId,
        source,
        promptVersion: 'ai-blueprint-v3',
        blueprintVersion: 3,
        orchestratorVersion: 'server-quiz-v1',
        quiz: serverQuiz,
      },
    });
  }).as('serverQuizGeneration');

  cy.visit('/teacher/quizzes?mode=create', { onBeforeLoad: installSession });
  cy.wait('@serverQuizFlag');
  if (source !== 'system') cy.wait('@credentialState');
  cy.contains('Tạo đề bằng AI', { timeout: 15_000 }).should('be.visible');
};

describe('Server-side quiz generation', () => {
  const generateFromTopic = (topic = 'Phép nhân lớp 3') => {
    cy.get('input[placeholder*="Động vật rừng xanh"]')
      .clear()
      .type(topic);
    cy.contains('button', '📚 Ra đề ÔN TẬP').click();
  };

  it('creates a V3 quiz with one top-level server request', () => {
    visitCreateTab();
    generateFromTopic();

    cy.wait('@serverQuizGeneration');
    cy.contains('Kết quả của 3 nhân 4', { timeout: 20_000 }).should('be.visible');
    cy.contains('Có 4 nhóm, mỗi nhóm 5 que tính', { timeout: 20_000 }).should('be.visible');
    cy.get('@legacyChat.all').should('have.length', 0);
  });

  it('routes Gemini personal generation through the server contract without exposing a key', () => {
    visitCreateTab({ source: 'gemini-personal' });
    generateFromTopic('Phép nhân Gemini');

    cy.wait('@serverQuizGeneration');
    cy.contains('Kết quả của 3 nhân 4', { timeout: 20_000 }).should('be.visible');
    cy.get('@serverQuizGeneration.all').should('have.length', 1);
    cy.get('@legacyChat.all').should('have.length', 0);
  });

  it('routes DeepSeek personal generation through the server contract without exposing a key', () => {
    visitCreateTab({ source: 'deepseek-personal' });
    generateFromTopic('Phép nhân DeepSeek');

    cy.wait('@serverQuizGeneration');
    cy.contains('Kết quả của 3 nhân 4', { timeout: 20_000 }).should('be.visible');
    cy.get('@serverQuizGeneration.all').should('have.length', 1);
    cy.get('@legacyChat.all').should('have.length', 0);
  });

  it('does not retry a transient 503 at the browser top-level', () => {
    visitCreateTab({
      statusCode: 503,
      errorCode: 'AI_PROVIDER_UNAVAILABLE',
      errorMessage: 'Nhà cung cấp AI tạm thời không khả dụng.',
    });
    generateFromTopic();

    cy.wait('@serverQuizGeneration');
    cy.contains('Nhà cung cấp AI tạm thời không khả dụng.', { timeout: 20_000 })
      .should('be.visible');
    cy.get('@serverQuizGeneration.all').should('have.length', 1);
    cy.get('@legacyChat.all').should('have.length', 0);
  });

  it('does not retry a non-retryable 401 at the browser top-level', () => {
    visitCreateTab({
      statusCode: 401,
      errorCode: 'AI_CREDENTIAL_INVALID',
      errorMessage: 'Thông tin xác thực AI không hợp lệ.',
    });
    generateFromTopic();

    cy.wait('@serverQuizGeneration');
    cy.contains('Thông tin xác thực AI không hợp lệ.', { timeout: 20_000 })
      .should('be.visible');
    cy.get('@serverQuizGeneration.all').should('have.length', 1);
    cy.get('@legacyChat.all').should('have.length', 0);
  });

  it('does not retry a non-retryable 429 at the browser top-level', () => {
    visitCreateTab({
      statusCode: 429,
      errorCode: 'AI_QUOTA_EXCEEDED',
      errorMessage: 'Bạn đã vượt hạn mức AI trong ngày.',
    });
    generateFromTopic();

    cy.wait('@serverQuizGeneration');
    cy.contains('Bạn đã vượt hạn mức AI trong ngày.', { timeout: 20_000 })
      .should('be.visible');
    cy.get('@serverQuizGeneration.all').should('have.length', 1);
    cy.get('@legacyChat.all').should('have.length', 0);
  });

  it('does not duplicate a request on a double-click while generation is pending', () => {
    visitCreateTab({ delayMs: 1000 });
    cy.get('input[placeholder*="Động vật rừng xanh"]')
      .clear()
      .type('Phép nhân double click');
    cy.contains('button', '📚 Ra đề ÔN TẬP').click();
    cy.contains('button', '📚 Ra đề ÔN TẬP').click({ force: true });

    cy.wait('@serverQuizGeneration');
    cy.get('@serverQuizGeneration.all').should('have.length', 1);
    cy.contains('Kết quả của 3 nhân 4', { timeout: 20_000 }).should('be.visible');
  });
});
