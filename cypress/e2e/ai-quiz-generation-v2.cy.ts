const TEACHER = 'ai-v2-e2e-teacher';

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

const dashboardStorageValue = JSON.stringify({
  state: { activeTab: 'create' },
  version: 2,
});

const quizStorageValue = JSON.stringify({
  state: { view: 'teacher_dash', quizzes: [] },
  version: 0,
});

const quotaPayload = {
  status: 'success',
  data: {
    username: TEACHER,
    role: 'teacher',
    usageDate: '2026-07-22',
    dailyLimit: 5,
    usedCount: 0,
    remaining: 5,
    canGenerate: true,
    unlimited: false,
  },
};

const ocrDocument = {
  pages: [
    { pageNumber: 1, text: `Kiến thức phân số trang một. ${'Nội dung học tập rõ ràng. '.repeat(8)}` },
    { pageNumber: 2, text: `Bài tập tham khảo trang hai. ${'Ví dụ và đáp án minh họa. '.repeat(8)}` },
    { pageNumber: 3, text: `Kiến thức vận dụng trang ba. ${'Tình huống thực tế phù hợp. '.repeat(8)}` },
  ],
  warnings: [],
  wasTruncated: false,
};

const commonQuestion = (id: string, difficultyLevel: 1 | 2 | 3) => ({
  id,
  difficultyLevel,
  explanation: `Lời giải chi tiết cho ${id}.`,
});

const validTenQuestionQuiz = {
  title: 'Ôn tập phân số lớp 4',
  detectedCategory: 'toan',
  detectedLesson: 'Phân số',
  suggestedTags: ['phan_so', 'lop_4', 'on_tap'],
  timeLimit: 20,
  questions: [
    {
      ...commonQuestion('mcq-1', 1),
      type: 'MCQ',
      question: 'Phân số nào biểu diễn một phần hai?',
      options: ['1/2', '2/1', '1/3', '3/1'],
      correctAnswer: 'A',
    },
    {
      ...commonQuestion('mcq-2', 2),
      type: 'MCQ',
      question: 'Phân số nào bằng hai phần tư?',
      options: ['1/2', '1/4', '2/3', '3/4'],
      correctAnswer: 'A',
    },
    {
      ...commonQuestion('mcq-3', 3),
      type: 'MCQ',
      question: 'Lan ăn ba phần tám chiếc bánh, phần còn lại là bao nhiêu?',
      options: ['5/8', '3/8', '4/8', '6/8'],
      correctAnswer: 'A',
    },
    {
      ...commonQuestion('tf-1', 1),
      type: 'TRUE_FALSE',
      mainQuestion: 'Xác định đúng hoặc sai về phân số.',
      items: [
        { id: 'tf-1-a', statement: 'Một phần hai nhỏ hơn một.', isCorrect: true },
        { id: 'tf-1-b', statement: 'Hai phần hai nhỏ hơn một.', isCorrect: false },
      ],
    },
    {
      ...commonQuestion('tf-2', 2),
      type: 'TRUE_FALSE',
      mainQuestion: 'So sánh các phân số cùng mẫu số.',
      items: [
        { id: 'tf-2-a', statement: 'Ba phần năm lớn hơn hai phần năm.', isCorrect: true },
        { id: 'tf-2-b', statement: 'Một phần năm lớn hơn bốn phần năm.', isCorrect: false },
      ],
    },
    {
      ...commonQuestion('tf-3', 2),
      type: 'TRUE_FALSE',
      mainQuestion: 'Nhận xét về phân số bằng nhau.',
      items: [
        { id: 'tf-3-a', statement: 'Một phần hai bằng hai phần tư.', isCorrect: true },
        { id: 'tf-3-b', statement: 'Một phần ba bằng hai phần ba.', isCorrect: false },
      ],
    },
    {
      ...commonQuestion('short-1', 1),
      type: 'SHORT_ANSWER',
      question: 'Viết phân số chỉ ba phần bằng nhau trong bốn phần.',
      correctAnswer: '3/4',
    },
    {
      ...commonQuestion('short-2', 2),
      type: 'SHORT_ANSWER',
      question: 'Rút gọn phân số bốn phần tám.',
      correctAnswer: '1/2',
    },
    {
      ...commonQuestion('match-1', 2),
      type: 'MATCHING',
      question: 'Nối phân số với cách đọc phù hợp.',
      pairs: [
        { left: '1/2', right: 'một phần hai' },
        { left: '2/3', right: 'hai phần ba' },
        { left: '3/4', right: 'ba phần tư' },
      ],
    },
    {
      ...commonQuestion('match-2', 3),
      type: 'MATCHING',
      question: 'Nối tình huống với phân số biểu diễn phần đã chọn.',
      pairs: [
        { left: 'Chọn 1 trong 3 phần', right: '1/3' },
        { left: 'Chọn 2 trong 5 phần', right: '2/5' },
        { left: 'Chọn 3 trong 8 phần', right: '3/8' },
      ],
    },
  ],
};

const malformedTenQuestionQuiz = {
  ...validTenQuestionQuiz,
  questions: validTenQuestionQuiz.questions.map((question, index) => (
    index === 0 ? { ...question, options: [] } : question
  )),
};

const SCHEMA_ERROR_MESSAGE =
  'AI tạo một số câu chưa đúng cấu trúc. Vui lòng thử tạo lại đề hoặc giảm số dạng câu trong một lần.';

type AiMode =
  | 'success'
  | 'failure'
  | 'cancel'
  | 'schema-repair-success'
  | 'schema-repair-failure';

const aiResponse = (payload: unknown) => ({
  choices: [{ message: { content: JSON.stringify(payload) } }],
});

const installSession = (win: Window) => {
  win.localStorage.setItem('auth-storage', authStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_dashboard_ui', dashboardStorageValue);
  win.localStorage.setItem('tohieuquiz-store', quizStorageValue);
};

const interceptBootstrap = () => {
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
  cy.intercept('GET', '**/api/teacher-ai-quota', {
    statusCode: 200,
    body: quotaPayload,
  }).as('quota');
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
};

const interceptAi = (mode: AiMode) => {
  cy.intercept('POST', '**/api/ai/chat', (request) => {
    const stage = request.body?._meta?.stage;
    if (stage === 'OCR') {
      request.reply({
        statusCode: 200,
        delay: 450,
        body: aiResponse(ocrDocument),
      });
      return;
    }
    if (stage === 'GENERATE' && mode === 'failure') {
      request.reply({
        statusCode: 503,
        delay: 250,
        body: { error: { message: 'Dịch vụ AI tạm thời không khả dụng.' } },
      });
      return;
    }
    if (stage === 'GENERATE' && mode === 'cancel') {
      request.reply({
        statusCode: 200,
        delay: 15_000,
        body: aiResponse(validTenQuestionQuiz),
      });
      return;
    }
    if (stage === 'GENERATE' && mode.startsWith('schema-repair-')) {
      request.reply({
        statusCode: 200,
        delay: 450,
        body: aiResponse(malformedTenQuestionQuiz),
      });
      return;
    }
    if (stage === 'REPAIR' && mode === 'schema-repair-success') {
      request.reply({
        statusCode: 200,
        delay: 450,
        body: aiResponse(validTenQuestionQuiz),
      });
      return;
    }
    if (stage === 'REPAIR' && mode === 'schema-repair-failure') {
      request.reply({
        statusCode: 200,
        delay: 450,
        body: aiResponse(malformedTenQuestionQuiz),
      });
      return;
    }
    request.reply({
      statusCode: 200,
      delay: stage === 'REVIEW' ? 700 : 450,
      body: aiResponse(validTenQuestionQuiz),
    });
  }).as('aiChat');
};

const visitCreateTab = (mode: AiMode) => {
  interceptBootstrap();
  interceptAi(mode);
  cy.visit('/', { onBeforeLoad: installSession });
  cy.contains('Tạo đề kiểm tra mới', { timeout: 15_000 }).should('be.visible');
  cy.contains(/^Dạng câu hỏi(?: & ma trận)?$/).should('be.visible');
  cy.contains('Lượt tạo đề AI hôm nay:').should('contain.text', '5/5');
};

const enterTopicAndUploadPdf = () => {
  cy.get('input[placeholder*="Động vật rừng xanh"]').clear().type('Phân số lớp 4');
  cy.contains('button', 'Nội dung bổ sung').click();
  cy.get('input[type="file"]').selectFile({
    contents: Cypress.Buffer.from('%PDF-1.4 E2E fixture'),
    fileName: 'phan-so-lop-4.pdf',
    mimeType: 'application/pdf',
  }, { force: true });
};

const readDocumentAndChoosePages = () => {
  cy.contains('button', /ĐỌC VÀ XEM TRƯỚC/).click();
  cy.contains('Đang đọc tài liệu').should('be.visible');
  cy.wait('@aiChat');
  cy.get('input[aria-label="Trang 2"]').uncheck();
  cy.contains('Đã chọn 2/3 trang').should('be.visible');
};

const expectAiStages = (expectedStages: string[]) => {
  cy.get('@aiChat.all').should((interceptions) => {
    const calls = interceptions as Array<{
      request: { body?: { _meta?: { stage?: string } } };
    }>;
    expect(calls.map((call) => call.request.body?._meta?.stage)).to.deep.equal(expectedStages);
  });
};

describe('AI quiz generation V2', () => {
  it('reads selected OCR pages, reviews ten questions and enables saving', () => {
    visitCreateTab('success');
    enterTopicAndUploadPdf();
    readDocumentAndChoosePages();

    cy.contains('button', 'TẠO ĐỀ TỪ 2 TRANG ĐÃ CHỌN').click();
    cy.contains('Đang tạo câu hỏi').should('be.visible');
    cy.contains('Đang kiểm tra đáp án', { timeout: 10_000 }).should('be.visible');
    cy.contains('10 câu', { timeout: 15_000 }).should('be.visible');
    cy.contains('button', 'Lưu đề').should('be.enabled');
  });

  it('repairs a malformed schema once before review and enables saving', () => {
    visitCreateTab('schema-repair-success');
    enterTopicAndUploadPdf();
    readDocumentAndChoosePages();

    cy.contains('button', 'TẠO ĐỀ TỪ 2 TRANG ĐÃ CHỌN').click();
    cy.contains('Đang tạo câu hỏi').should('be.visible');
    cy.contains('Đang sửa các câu chưa đạt', { timeout: 10_000 }).should('be.visible');
    cy.contains('Đang kiểm tra đáp án', { timeout: 10_000 }).should('be.visible');
    cy.contains('10 câu', { timeout: 15_000 }).should('be.visible');
    cy.contains('button', 'Lưu đề').should('be.enabled');
    expectAiStages(['OCR', 'GENERATE', 'REPAIR', 'REVIEW']);
  });

  it('stops after one malformed schema repair and shows a concise error', () => {
    visitCreateTab('schema-repair-failure');
    enterTopicAndUploadPdf();
    readDocumentAndChoosePages();

    cy.contains('button', 'TẠO ĐỀ TỪ 2 TRANG ĐÃ CHỌN').click();
    cy.contains(SCHEMA_ERROR_MESSAGE, { timeout: 10_000 }).should('be.visible');
    cy.get('body').should('not.contain.text', 'too_small');
    cy.get('body').should('not.contain.text', 'invalid_type');
    cy.get('body').should('not.contain.text', 'questions');
    expectAiStages(['OCR', 'GENERATE', 'REPAIR']);
  });

  it('keeps quota and form values after a 503 generation failure', () => {
    visitCreateTab('failure');
    enterTopicAndUploadPdf();
    readDocumentAndChoosePages();

    cy.contains('button', 'TẠO ĐỀ TỪ 2 TRANG ĐÃ CHỌN').click();
    cy.contains('Dịch vụ AI tạm thời không khả dụng.', { timeout: 10_000 }).should('be.visible');
    cy.get('input[placeholder*="Động vật rừng xanh"]').should('have.value', 'Phân số lớp 4');
    cy.contains('Lượt tạo đề AI hôm nay:').should('contain.text', '5/5');
  });

  it('cancels a pending request and preserves the form', () => {
    visitCreateTab('cancel');
    enterTopicAndUploadPdf();
    readDocumentAndChoosePages();

    cy.contains('button', 'TẠO ĐỀ TỪ 2 TRANG ĐÃ CHỌN').click();
    cy.contains('Đang tạo câu hỏi').should('be.visible');
    cy.contains('button', 'Hủy tạo đề').click();
    cy.contains('Đã hủy yêu cầu').should('be.visible');
    cy.get('input[placeholder*="Động vật rừng xanh"]').should('have.value', 'Phân số lớp 4');
    cy.contains('Lượt tạo đề AI hôm nay:').should('contain.text', '5/5');
  });
});
