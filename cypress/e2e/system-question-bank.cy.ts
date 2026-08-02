const adminStorage = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'admin.question-bank',
    teacherName: 'Quản trị ngân hàng',
    isAdmin: true,
    teacherClass: '',
  },
  version: 0,
});

const questionData = {
  id: 'm5-s1-l06-q01',
  type: 'MCQ',
  question: '2/5 + 1/3 bằng bao nhiêu?',
  options: ['3/8', '11/15', '3/15', '1/2'],
  correctAnswer: 'B',
  difficulty: 1,
  subject: 'MATH',
  points: 1,
};

const systemItem = {
  id: 'qb-m5-s1-l06-q01',
  scope: 'SYSTEM',
  ownerId: '',
  status: 'DRAFT',
  questionData,
  questionText: questionData.question,
  questionType: 'MCQ',
  difficulty: 1,
  explanation: '',
  metadata: {
    grade: 5,
    subject: 'MATH',
    semester: 1,
    topicCode: 'M5-S1-T02',
    lessonCode: 'M5-S1-L06',
    source: 'CURATED_ORIGINAL',
    tags: ['Toán', 'Lớp 5', 'Học kì 1', 'Bài 6'],
  },
  createdBy: 'admin.question-bank',
  updatedBy: 'admin.question-bank',
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  publishedAt: null,
  archivedAt: null,
};

const installQuestionBankApi = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      status: 'success',
      data: {
        username: 'admin.question-bank',
        fullName: 'Quản trị ngân hàng',
        role: 'admin',
        classes: [],
        mustChangePassword: false,
      },
    },
  }).as('account');
  cy.intercept({
    method: 'GET',
    pathname: '/api/system-settings/feature-flags/resolve',
    query: { flag: 'system_question_bank_v1' },
  }, (request) => {
    request.reply({
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          key: 'system_question_bank_v1',
          enabled: true,
          reason: 'allowlist',
          bucket: 1,
          version: 1,
        },
      },
    });
  }).as('resolveQuestionBankFlag');
  cy.intercept({ method: 'GET', pathname: '/api/test-bank' }, (request) => {
    const status = String(request.query.status || '');
    const pageSize = Number(request.query.pageSize || 30);
    const counts: Record<string, number> = { DRAFT: 12, PUBLISHED: 28, ARCHIVED: 4 };
    if (pageSize === 1) {
      request.reply({
        statusCode: 200,
        body: {
          items: [],
          pagination: { page: 1, pageSize: 1, totalItems: counts[status] || 0, totalPages: counts[status] ? counts[status] : 0 },
          appliedFilters: request.query,
        },
      });
      return;
    }
    request.reply({
      statusCode: 200,
      body: {
        items: status === 'DRAFT' || !status ? [systemItem] : [],
        pagination: { page: 1, pageSize, totalItems: status === 'DRAFT' || !status ? 1 : 0, totalPages: status === 'DRAFT' || !status ? 1 : 0 },
        appliedFilters: request.query,
      },
    });
  }).as('questionBankList');
  cy.intercept('PATCH', '**/api/test-bank/qb-m5-s1-l06-q01', (request) => {
    expect(request.body).to.deep.equal({ status: 'PUBLISHED' });
    request.reply({ statusCode: 200, body: { item: { ...systemItem, status: 'PUBLISHED' } } });
  }).as('publishQuestion');
  cy.intercept('DELETE', '**/api/test-bank/qb-m5-s1-l06-q01', {
    statusCode: 200,
    body: { status: 'success' },
  }).as('archiveQuestion');
  cy.intercept('POST', '**/api/test-bank/bulk', (request) => {
    expect(request.body.items).to.have.length(1);
    request.reply({
      statusCode: 200,
      body: {
        summary: { received: 1, created: 1, duplicates: 0, invalid: 0 },
        results: [{ index: 0, status: 'CREATED', id: 'qb-imported' }],
      },
    });
  }).as('bulkImport');
};

const visitAdminBank = (width = 1440, height = 900) => {
  cy.viewport(width, height);
  installQuestionBankApi();
  cy.visit('/teacher/system-question-bank', {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', adminStorage);
    },
  });
  cy.wait('@account');
  cy.wait('@resolveQuestionBankFlag');
  cy.contains('h1', 'Ngân hàng câu hỏi hệ thống', { timeout: 20_000 }).should('be.visible');
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth)
      .to.be.lte(document.documentElement.clientWidth + 1);
  });
};

describe('System question bank administration', () => {
  it('loads status totals, filters and performs publish/archive actions', () => {
    visitAdminBank();
    cy.contains('button', 'Bản nháp').should('contain.text', '12');
    cy.contains('button', 'Đã phát hành').should('contain.text', '28');
    cy.contains('button', 'Đã lưu trữ').should('contain.text', '4');
    cy.contains('2/5 + 1/3 bằng bao nhiêu?').should('be.visible');
    cy.get('select[aria-label="Lọc theo lớp"]').select('5');
    cy.get('select[aria-label="Lọc theo môn"]').select('MATH');
    cy.get('select[aria-label="Lọc theo bài"]').select('M5-S1-L06');
    cy.contains('button', 'Phát hành').click();
    cy.wait('@publishQuestion');
    cy.contains('button', 'Lưu trữ').click();
    cy.wait('@archiveQuestion');
    assertNoHorizontalOverflow();
  });

  it('previews a JSON file, imports one draft and stays usable at 390 px', () => {
    visitAdminBank(390, 844);
    const payload = [{
      id: 'qb-imported',
      scope: 'SYSTEM',
      status: 'DRAFT',
      questionData,
      metadata: systemItem.metadata,
    }];
    cy.get('input[aria-label="Chọn file JSON câu hỏi"]').selectFile({
      contents: Cypress.Buffer.from(JSON.stringify(payload)),
      fileName: 'math5-sample.json',
      mimeType: 'application/json',
    }, { force: true });
    cy.contains('Sẵn sàng nhập 1 câu').should('be.visible');
    cy.contains('button', 'Nhập 1 câu vào bản nháp').click();
    cy.wait('@bulkImport');
    cy.contains('Kết quả nhập dữ liệu').should('be.visible');
    cy.contains('CREATED').should('be.visible');
    assertNoHorizontalOverflow();
    cy.viewport(768, 1024);
    assertNoHorizontalOverflow();
  });
});
