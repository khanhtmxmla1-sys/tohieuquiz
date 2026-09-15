/// <reference types="cypress" />

const pixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const richPrompt = (text: string) => ({
  schemaVersion: 1,
  doc: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text, marks: [{ type: 'bold' }] }],
    }],
  },
});

const student = {
  studentId: 'student-review-fixture',
  fullName: 'Học sinh kiểm thử',
  username: 'student.review.fixture',
  classId: 'class-review',
  className: '5A',
  avatar: '',
  coins: 0,
  pet: null,
  shopItems: [],
};

const currentQuiz = {
  id: 'quiz-review-fixture',
  title: 'Bài kiểm thử xem lại bài',
  classLevel: '5',
  category: 'toan',
  subject: 'toan',
  timeLimit: 30,
  duration: 30,
  requireCode: false,
  allowReview: true,
  createdAt: '2026-09-10T08:00:00.000Z',
  maxScore: 10,
  questions: [
    {
      id: 'review-image',
      type: 'IMAGE_QUESTION',
      question: 'Phiên bản hiện tại không được dùng',
      questionRichText: richPrompt('Phiên bản lịch sử mới nhất: $24 \\div 6$ bằng bao nhiêu?'),
      image: pixel,
      options: ['Hình vuông', 'Hình vuông'],
      optionImages: [pixel, pixel],
      correctAnswer: 'B',
    },
    {
      id: 'review-true-false',
      type: 'TRUE_FALSE',
      question: 'Đánh dấu đúng hoặc sai cho từng mệnh đề.',
      statements: [
        { id: 'statement-a', text: '24 chia 6 bằng 4.' },
        { id: 'statement-b', text: '24 chia 6 bằng 5.' },
      ],
      correctAnswers: { 'statement-a': true, 'statement-b': false },
    },
    {
      id: 'review-explanation',
      type: 'MCQ',
      question: 'Một đoạn câu hỏi dài để kiểm thử xuống dòng trên màn hình nhỏ: chọn đáp án đúng.',
      options: ['Sai', 'Đúng'],
      correctAnswer: 'B',
      explanation: 'Vì $24 \\div 6 = 4$, nên đáp án đúng là B.',
    },
  ],
};

const historicalQuestions = [
  {
    ...currentQuiz.questions[0],
    question: 'Phiên bản lịch sử cũ không được hiển thị',
    questionRichText: richPrompt('Phiên bản lịch sử mới nhất: $24 \\div 6$ bằng bao nhiêu?'),
  },
  currentQuiz.questions[1],
  currentQuiz.questions[2],
];

const assignment = {
  id: 'assignment-review-fixture',
  quizId: currentQuiz.id,
  classId: student.classId,
  studentId: student.studentId,
  quizTitle: currentQuiz.title,
  deadline: '2030-09-30T08:00:00.000Z',
  maxAttempts: 2,
  attemptCount: 2,
  status: 'OPEN',
  createdAt: '2026-09-10T08:00:00.000Z',
};

const oldResult = {
  id: 'result-review-old',
  studentId: student.studentId,
  assignmentId: assignment.id,
  studentName: student.fullName,
  studentClass: student.className,
  quizId: currentQuiz.id,
  quizTitle: currentQuiz.title,
  score: 3,
  correctCount: 1,
  totalQuestions: 3,
  timeTaken: 240,
  submittedAt: '2026-09-11T08:00:00.000Z',
  answers: '{}',
};

const latestResult = {
  ...oldResult,
  id: 'result-review-latest',
  score: 4,
  submittedAt: '2026-09-12T08:00:00.000Z',
};

const latestAnswers = {
  _questionOrder: ['review-image', 'review-true-false', 'review-explanation'],
  'review-image': {
    selectedAnswer: { type: 'IMAGE_QUESTION', optionId: 'option-0' },
    isCorrect: false,
    questionSnapshot: historicalQuestions[0],
  },
  'review-true-false': {
    selectedAnswer: { type: 'TRUE_FALSE', values: {} },
    isCorrect: false,
    status: 'skipped',
    questionSnapshot: historicalQuestions[1],
  },
  'review-explanation': {
    selectedAnswer: { type: 'MCQ', optionId: 'option-0' },
    isCorrect: false,
    questionSnapshot: historicalQuestions[2],
  },
};

const latestReviewDetails = [
  {
    questionId: 'review-image',
    type: 'IMAGE_QUESTION',
    status: 'wrong',
    isCorrect: false,
    studentAnswer: { kind: 'text', lines: [{ value: 'Hình vuông' }] },
    correctAnswer: { kind: 'text', lines: [{ value: 'Hình vuông' }] },
    presentation: {
      schemaVersion: 1,
      source: 'submission',
      type: 'IMAGE_QUESTION',
      items: [
        { id: 'option-0', index: 0, text: 'Hình vuông', selected: true, correct: false, state: 'incorrect' },
        { id: 'option-1', index: 1, text: 'Hình vuông', selected: false, correct: true, state: 'skipped' },
      ],
    },
  },
  {
    questionId: 'review-true-false',
    type: 'TRUE_FALSE',
    status: 'skipped',
    isCorrect: false,
    studentAnswer: { kind: 'empty', lines: [] },
    correctAnswer: { kind: 'empty', lines: [] },
    presentation: {
      schemaVersion: 1,
      source: 'submission',
      type: 'TRUE_FALSE',
      items: [
        { id: 'statement-a', index: 0, statement: '24 chia 6 bằng 4.', correctValue: true, state: 'skipped' },
        { id: 'statement-b', index: 1, statement: '24 chia 6 bằng 5.', correctValue: false, state: 'skipped' },
      ],
    },
  },
  {
    questionId: 'review-explanation',
    type: 'MCQ',
    status: 'wrong',
    isCorrect: false,
    studentAnswer: { kind: 'text', lines: [{ value: 'Sai' }] },
    correctAnswer: { kind: 'text', lines: [{ value: 'Đúng' }] },
    presentation: {
      schemaVersion: 1,
      source: 'submission',
      type: 'MCQ',
      items: [
        { id: 'option-0', index: 0, text: 'Sai', selected: true, correct: false, state: 'incorrect' },
        { id: 'option-1', index: 1, text: 'Đúng', selected: false, correct: true, state: 'skipped' },
      ],
    },
  },
];

const installStudentState = (win: Window) => {
  win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'studentDashboard',
      quizzes: [currentQuiz],
      results: [],
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};

const stubStudentApis = (answersShouldFailOnce = false) => {
  let answerRequestCount = 0;
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/student-profile', {
    statusCode: 200,
    body: { status: 'success', data: student },
  }).as('studentProfile');
  cy.intercept({ method: 'GET', pathname: '/api/assignments' }, {
    statusCode: 200,
    body: { status: 'success', data: [assignment] },
  }).as('studentAssignments');
  cy.intercept('GET', '**/api/results*', {
    statusCode: 200,
    body: [oldResult, latestResult],
  }).as('studentResults');
  cy.intercept('GET', '**/api/results/result-review-latest/answers', (request) => {
    answerRequestCount += 1;
    if (answersShouldFailOnce && answerRequestCount === 1) {
      request.reply({
        statusCode: 503,
        body: {
          error: {
            message: 'Tạm thời không tải được bài làm.',
            code: 'TEMP',
          },
        },
      });
      return;
    }
    request.reply({
      statusCode: 200,
      body: { answers: latestAnswers, reviewDetails: latestReviewDetails },
    });
  }).as('latestAnswers');
};

const openLatestReview = () => {
  cy.wait('@studentProfile');
  cy.wait('@studentAssignments', { timeout: 20_000 });
  cy.contains(currentQuiz.title, { timeout: 20_000 }).should('be.visible');
  cy.contains('button', 'Xem kết quả').click();
  cy.wait('@studentResults');
  cy.wait('@latestAnswers');
  cy.get('[role="tabpanel"]', { timeout: 20_000 }).should('be.visible');
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth, 'document scrollWidth')
      .to.be.at.most(doc.documentElement.clientWidth + 1);
  });
};

describe('Student answer review integration', () => {
  it('opens the latest attempt, renders structured states, filters, explanation and reopens the same result', () => {
    stubStudentApis();
    cy.visit('/student/assignments', { onBeforeLoad: installStudentState });
    openLatestReview();

    cy.get('[role="tabpanel"]').within(() => {
      cy.contains('Phiên bản lịch sử mới nhất').should('be.visible');
      cy.contains('Phiên bản hiện tại không được dùng').should('not.exist');
      cy.get('[data-testid="student-review-option"]').should('have.length', 4);
      cy.get('[data-testid="student-review-option"]').eq(0).should('have.attr', 'data-option-id', 'option-0');
      cy.get('[data-testid="student-review-option"]').eq(1).should('have.attr', 'data-option-id', 'option-1');
      cy.get('[data-testid="student-review-option"]').eq(0).should('contain.text', 'Em chọn · Sai');
      cy.get('[data-testid="student-review-option"]').eq(1).should('contain.text', 'Đáp án đúng · Em chưa chọn');
      cy.get('[data-testid="student-review-true-false-row"]').should('have.length', 2);
      cy.get('[data-testid="student-review-true-false-row"]').each(($row) => {
        cy.wrap($row).should('contain.text', 'Chưa trả lời ý này');
      });
      cy.get('[data-testid="student-review-option"] img').should('have.length', 2);
      cy.get('img').should('have.length', 3);
      cy.contains('button', 'Xem lời giải').should('have.attr', 'aria-expanded', 'false').click();
      cy.contains('nên đáp án đúng là B.').should('be.visible');
      cy.contains('button', 'Ẩn lời giải').should('have.attr', 'aria-expanded', 'true');

      cy.contains('button', 'Câu sai 2').click();
      cy.contains('Phiên bản lịch sử mới nhất').should('be.visible');
      cy.contains('Đánh dấu đúng hoặc sai cho từng mệnh đề.').should('not.exist');
      cy.contains('Một đoạn câu hỏi dài để kiểm thử xuống dòng').should('be.visible');

      cy.contains('button', 'Chưa làm 1').click();
      cy.contains('Phiên bản lịch sử mới nhất').should('not.exist');
      cy.contains('Đánh dấu đúng hoặc sai cho từng mệnh đề.').should('be.visible');
    });

    [360, 390, 768, 1280].forEach((width) => {
      cy.viewport(width, 900);
      assertNoHorizontalOverflow();
      if (width === 390) {
        cy.screenshot('student-answer-review-390', { capture: 'viewport' });
      }
    });

    cy.contains('button', 'Về trang chủ').click();
    cy.contains('h2', 'Bài được giao', { timeout: 20_000 }).should('be.visible');
    cy.contains('button', 'Xem kết quả').click();
    cy.wait('@studentResults');
    cy.wait('@latestAnswers');
    cy.get('[role="tabpanel"]').within(() => {
      cy.contains('Phiên bản lịch sử mới nhất').should('be.visible');
      cy.contains('Đánh dấu đúng hoặc sai cho từng mệnh đề.').should('be.visible');
    });
  });

  it('shows the API error through the existing toast and allows retrying the result review', () => {
    stubStudentApis(true);
    cy.visit('/student/assignments', { onBeforeLoad: installStudentState });
    cy.wait('@studentProfile');
    cy.wait('@studentAssignments', { timeout: 20_000 });
    cy.contains(currentQuiz.title, { timeout: 20_000 }).should('be.visible');
    cy.contains('button', 'Xem kết quả').click();
    cy.wait('@studentResults');
    cy.wait('@latestAnswers');

    cy.contains('Tạm thời không tải được bài làm.', { timeout: 10_000 }).should('be.visible');
    cy.contains('h2', 'Bài được giao').should('be.visible');
    cy.contains('button', 'Xem kết quả').click();
    cy.wait('@studentResults');
    cy.wait('@latestAnswers');
    cy.get('[role="tabpanel"]', { timeout: 20_000 }).should('be.visible');
    cy.contains('Phiên bản lịch sử mới nhất').should('be.visible');
  });
});
