/// <reference types="cypress" />

const QUIZ_ID = 'scoring-matrix-14';

const questions = [
  { id: 'mcq', quizId: QUIZ_ID, type: 'MCQ', question: 'Chọn số bốn.\nDòng hướng dẫn thứ hai.', options: ['2', '4', '6'], correctAnswer: 'B' },
  { id: 'image', quizId: QUIZ_ID, type: 'IMAGE_QUESTION', question: 'Chọn hình tròn.', options: ['tròn', 'vuông'], optionImages: ['', ''], correctAnswer: 'A' },
  { id: 'multi', quizId: QUIZ_ID, type: 'MULTIPLE_SELECT', question: 'Chọn số chẵn.', options: ['1', '2', '3', '4'], correctAnswers: ['B', 'D'] },
  { id: 'short', quizId: QUIZ_ID, type: 'SHORT_ANSWER', question: 'Thủ đô Việt Nam là gì?', correctAnswer: 'Hà Nội|Ha Noi' },
  {
    id: 'tf', quizId: QUIZ_ID, type: 'TRUE_FALSE', mainQuestion: 'Đánh dấu đúng hoặc sai.',
    items: [
      { id: 't1', statement: 'Một phần hai nhỏ hơn một.', isCorrect: true },
      { id: 't2', statement: 'Hai phần hai nhỏ hơn một.', isCorrect: false },
    ],
  },
  {
    id: 'matching', quizId: QUIZ_ID, type: 'MATCHING', question: 'Nối chữ với số.',
    pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }],
  },
  {
    id: 'drag', quizId: QUIZ_ID, type: 'DRAG_DROP', question: 'Điền hai màu.',
    text: '[blank_0] và [blank_1]', blanks: ['xanh', 'đỏ'], distractors: ['vàng'],
  },
  {
    id: 'dropdown', quizId: QUIZ_ID, type: 'DROPDOWN', question: 'Chọn chữ đúng.', text: '[blank_0]',
    blanks: [{ id: 'blank_0', options: ['x', 'y'], correctAnswer: 'x' }],
  },
  {
    id: 'ordering', quizId: QUIZ_ID, type: 'ORDERING', question: 'Sắp xếp A trước B.',
    items: ['B', 'A'], correctOrder: [1, 0],
  },
  {
    id: 'category', quizId: QUIZ_ID, type: 'CATEGORIZATION', question: 'Phân loại số.',
    categories: [{ id: 'even', name: 'Chẵn' }, { id: 'odd', name: 'Lẻ' }],
    items: [{ id: '2', content: '2', categoryId: 'even' }, { id: '3', content: '3', categoryId: 'odd' }],
  },
  {
    id: 'underline', quizId: QUIZ_ID, type: 'UNDERLINE', question: 'Gạch chân động từ và danh từ.',
    words: ['Em', 'học', 'bài'], correctWordIndexes: [1, 2],
  },
  {
    id: 'scramble', quizId: QUIZ_ID, type: 'WORD_SCRAMBLE', question: 'Ghép thành tên một loài hoa.',
    letters: ['O', 'H', 'A'], correctWord: 'HOA',
  },
  {
    id: 'riddle', quizId: QUIZ_ID, type: 'RIDDLE', question: 'Giải câu đố.',
    riddleLines: ['Hoa gì thường nở vào mùa hè?'], correctAnswer: 'hoa phượng|phượng',
  },
  {
    id: 'error', quizId: QUIZ_ID, type: 'ERROR_CORRECTION', question: 'Tìm và sửa lỗi chính tả.',
    passage: 'Bạn nhỏ rất ngoãn.', wrongWord: 'ngoãn', correctWord: 'ngoan',
  },
] as const;

const quiz = {
  id: QUIZ_ID,
  title: 'Ma trận chấm điểm 14 dạng câu hỏi',
  classLevel: '4',
  category: 'kiem-thu',
  timeLimit: 30,
  requireCode: false,
  isPractice: true,
  questions,
};

const installQuiz = (win: Window) => {
  Object.defineProperty(win.Math, 'random', {
    configurable: true,
    value: () => 0.999999,
  });
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'student',
      quizzes: [quiz],
      selectedQuiz: quiz,
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};


const skippedQuestions = [
  ...Array.from({ length: 13 }, (_, index) => ({
    id: `answered-${index + 1}`,
    quizId: 'result-review-skipped-15',
    type: 'MCQ',
    question: `Câu đã làm ${index + 1}`,
    options: ['Đúng', 'Sai'],
    correctAnswer: 'A',
  })),
  {
    id: 'skipped-drag-14', quizId: 'result-review-skipped-15', type: 'DRAG_DROP',
    question: 'Kéo các số vào đúng chỗ trống để hoàn thành bài giải.',
    text: '[1]', blanks: [{ id: 'blank-14', correctAnswer: '24' }], distractors: ['6'],
  },
  {
    id: 'skipped-drag-15', quizId: 'result-review-skipped-15', type: 'DRAG_DROP',
    question: 'Kéo các số vào đúng chỗ trống. Đây là dạng tìm số đơn vị.',
    text: '[1]', blanks: [{ id: 'blank-15', correctAnswer: '6' }], distractors: ['24'],
  },
];

const skippedQuiz = {
  id: 'result-review-skipped-15',
  title: 'Kiểm tra xem lại câu bỏ trống',
  classLevel: '4',
  category: 'kiem-thu',
  timeLimit: 30,
  requireCode: false,
  isPractice: true,
  questions: skippedQuestions,
};

const installSkippedQuiz = (win: Window) => {
  Object.defineProperty(win.Math, 'random', {
    configurable: true,
    value: () => 0.999999,
  });
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'student',
      quizzes: [skippedQuiz],
      selectedQuiz: skippedQuiz,
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};
const withinQuestion = (id: string, callback: () => void) => {
  cy.get(`#question-${id}`, { timeout: 15_000 }).scrollIntoView().should('be.visible').within(callback);
};

describe('Canonical scoring browser matrix', () => {
  it('submits correct renderer payloads for all 14 published question types', () => {
    cy.intercept('GET', '**/api/system-settings*', {
      statusCode: 200,
      body: { status: 'success', data: { aiAssistantEnabled: false } },
    });

    let validateCalls = 0;
    cy.intercept('POST', '**/api/validate', (request) => {
      validateCalls += 1;
      request.reply({ statusCode: 500, body: { status: 'error', message: 'Practice must not call /api/validate' } });
    }).as('unexpectedValidate');

    cy.visit('/', { onBeforeLoad: installQuiz });
    cy.contains('Ma trận chấm điểm 14 dạng câu hỏi', { timeout: 15_000 }).should('be.visible');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh kiểm thử');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();

    withinQuestion('mcq', () => {
      cy.contains('span', 'Chọn số bốn.').should('have.css', 'white-space', 'pre-line');
      cy.contains('span', 'Dòng hướng dẫn thứ hai.').should('be.visible');
      cy.get('button').eq(1).click();
    });
    withinQuestion('image', () => cy.get('button').eq(0).click());
    withinQuestion('multi', () => {
      cy.get('button').eq(1).click();
      cy.get('button').eq(3).click();
    });
    withinQuestion('short', () => cy.get('input[placeholder="Nhập câu trả lời của em..."]').type(' HÀ NỘI '));
    withinQuestion('tf', () => {
      cy.get('button').eq(0).click();
      cy.get('button').eq(3).click();
    });
    withinQuestion('matching', () => {
      cy.contains('button', /^A$/).click();
      cy.contains('button', /^1$/).click();
      cy.contains('button', /^B$/).click();
      cy.contains('button', /^2$/).click();
    });
    withinQuestion('drag', () => {
      cy.contains('button', /^xanh$/i).click();
      cy.contains('button', /^đỏ$/i).click();
    });
    withinQuestion('dropdown', () => cy.get('select').select('x'));
    withinQuestion('ordering', () => {
      cy.get('input[type="number"]').eq(0).type('2');
      cy.get('input[type="number"]').eq(1).type('1');
    });
    withinQuestion('category', () => {
      cy.contains('div', /^2$/).parent().within(() => cy.contains('button', 'Chẵn').click());
      cy.contains('div', /^3$/).parent().within(() => cy.contains('button', 'Lẻ').click());
    });

    cy.contains('button', 'Trang tiếp theo').click();
    cy.contains('Trang 2 / 2').scrollIntoView().should('be.visible');

    withinQuestion('underline', () => {
      cy.get('button').eq(1).click();
      cy.get('button').eq(2).click();
    });
    withinQuestion('scramble', () => {
      cy.get('button[aria-label="Chọn chữ H"]').click();
      cy.get('button[aria-label="Chọn chữ O"]').click();
      cy.get('button[aria-label="Chọn chữ A"]').click();
    });
    withinQuestion('riddle', () => cy.get('input[aria-label="Đáp án câu đố"]').type('Hoa Phượng'));
    withinQuestion('error', () => {
      cy.get('input[aria-label="Từ viết sai"]').type('NGOÃN');
      cy.get('input[aria-label="Từ sửa đúng"]').type('Ngoan');
    });

    cy.contains('button', 'Nộp bài').click();
    cy.contains('Bạn đã hoàn thành tất cả câu hỏi.').should('be.visible');
    cy.contains('button', 'Đồng ý nộp').click();

    cy.then(() => expect(validateCalls, 'practice /api/validate calls').to.equal(0));
    cy.get('[role="dialog"]').within(() => {
      cy.contains('10/10').should('be.visible');
      cy.contains('14/14 câu đúng').should('be.visible');
      cy.contains('button', 'Xem kết quả').click();
    });
    cy.get('#result-summary-title').should('have.text', '10/10');
    cy.contains('14 đúng · 0 sai · 0 chưa làm').should('be.visible');
  });
  it('shows two unanswered drag-drop questions without leaking result metadata', () => {
    cy.intercept('GET', '**/api/system-settings*', {
      statusCode: 200,
      body: { status: 'success', data: { aiAssistantEnabled: false } },
    });

    let validateCalls = 0;
    cy.intercept('POST', '**/api/validate', (request) => {
      validateCalls += 1;
      request.reply({ statusCode: 500, body: { status: 'error', message: 'Practice must not call /api/validate' } });
    }).as('unexpectedSkippedValidate');

    cy.visit('/', { onBeforeLoad: installSkippedQuiz });
    cy.contains('Kiểm tra xem lại câu bỏ trống', { timeout: 15_000 }).should('be.visible');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh kiểm thử');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();

    for (let index = 1; index <= 10; index += 1) {
      withinQuestion(`answered-${index}`, () => cy.get('button').eq(0).click());
    }
    cy.contains('button', 'Trang tiếp theo').click();
    for (let index = 11; index <= 13; index += 1) {
      withinQuestion(`answered-${index}`, () => cy.get('button').eq(0).click());
    }

    cy.contains('button', 'Nộp bài').click();
    cy.contains('p', '2 câu chưa bắt đầu').should('be.visible');
    cy.contains('button', 'Đồng ý nộp').click();
    cy.then(() => expect(validateCalls, 'practice /api/validate calls').to.equal(0));

    cy.get('[role="dialog"]').within(() => {
      cy.contains('13/15 câu đúng').should('be.visible');
      cy.contains('button', 'Xem kết quả').click();
    });
    cy.contains('13 đúng · 0 sai · 2 chưa làm').should('be.visible');
    cy.get('[role="tab"]', { timeout: 10_000 }).contains('Xem lại bài').click();
    cy.contains('button', 'Câu sai 0').should('be.visible');
    cy.contains('button', 'Chưa làm 2').should('be.visible').click();
    cy.get('[role="tabpanel"]').within(() => {
      cy.contains('Kéo các số vào đúng chỗ trống để hoàn thành bài giải.').should('be.visible');
      cy.contains('Kéo các số vào đúng chỗ trống. Đây là dạng tìm số đơn vị.').should('be.visible');
      cy.contains('Chỗ trống 1').should('be.visible');
      cy.contains('24').should('be.visible');
      cy.contains('6').should('be.visible');
      cy.contains('isCorrect').should('not.exist');
      cy.contains('gradingVersion').should('not.exist');
      cy.contains('questionSnapshot').should('not.exist');
      cy.contains('[object Object]').should('not.exist');
    });
  });

  it('submits a secure practice session to authoritative grading and renders its review', () => {
    const { correctAnswer: _correctAnswer, ...safeQuestion } = questions[0];
    const secureQuiz = {
      ...quiz,
      id: 'secure-practice-browser',
      title: 'Luyện tập bảo mật qua Worker',
      questions: [{ ...safeQuestion, id: 'secure-mcq' }],
      practiceSession: {
        version: 'server-v1',
        token: 'browser-session-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    };
    const gradeRequests: Cypress.Request[] = [];
    let validateCalls = 0;
    let resultCalls = 0;

    cy.intercept('GET', '**/api/system-settings*', {
      statusCode: 200,
      body: { status: 'success', data: { aiAssistantEnabled: false } },
    });
    cy.intercept('POST', '**/api/validate', (request) => {
      validateCalls += 1;
      request.reply({ statusCode: 500, body: { status: 'error', message: 'Secure practice must not call /api/validate' } });
    }).as('unexpectedSecureValidate');
    cy.intercept('POST', '**/api/results', (request) => {
      resultCalls += 1;
      request.reply({ statusCode: 500, body: { status: 'error', message: 'Secure practice must not save results' } });
    }).as('unexpectedSecureResult');
    cy.intercept('POST', '**/api/practice/grade', (request) => {
      gradeRequests.push(request);
      expect(request.body).to.deep.equal({
        sessionToken: 'browser-session-token',
        answers: { 'secure-mcq': { type: 'MCQ', optionId: 'option-1' } },
        questionOrder: ['secure-mcq'],
      });
      expect(request.body).not.to.have.any.keys('score', 'correctCount', 'gradingVersion', 'questionSnapshot');
      request.reply({
        statusCode: 200,
        body: {
          status: 'success', practiceId: 'secure-practice-browser', score: 10,
          correctCount: 1, questionCount: 1, totalQuestions: 1, voidedCount: 0,
          gradingVersion: 'server-v1',
          answers: { 'secure-mcq': { selectedAnswer: 'B', isCorrect: true, status: 'correct' } },
          validationDetails: [{ questionId: 'secure-mcq', type: 'MCQ', isCorrect: true, status: 'correct' }],
          reviewDetails: [{
            questionId: 'secure-mcq', type: 'MCQ', status: 'correct', isCorrect: true,
            studentAnswer: { kind: 'text', lines: [{ value: '4' }] },
            correctAnswer: { kind: 'text', lines: [{ value: '4' }] },
            presentation: {
              schemaVersion: 1, source: 'submission', type: 'MCQ',
              items: [{ id: 'option-1', index: 1, state: 'correct', text: '4', selected: true, correct: true }],
            },
          }],
        },
      });
    }).as('securePracticeGrade');

    cy.visit('/', { onBeforeLoad: (win) => {
      Object.defineProperty(win.Math, 'random', {
        configurable: true,
        value: () => 0.999999,
      });
      win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
        state: {
          view: 'student', quizzes: [secureQuiz], selectedQuiz: secureQuiz, quizzesLoadedAt: Date.now(),
        },
        version: 0,
      }));
    } });
    cy.contains('Luyện tập bảo mật qua Worker', { timeout: 15_000 }).should('be.visible');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh secure');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();
    withinQuestion('secure-mcq', () => cy.get('button').eq(1).click());
    cy.contains('button', 'Nộp bài').click();
    cy.contains('Bạn đã hoàn thành tất cả câu hỏi.').should('be.visible');
    cy.contains('button', 'Đồng ý nộp').click();
    cy.wait('@securePracticeGrade');
    cy.then(() => {
      expect(gradeRequests, 'secure grade requests').to.have.length(1);
      expect(validateCalls, 'secure /api/validate calls').to.equal(0);
      expect(resultCalls, 'secure /api/results calls').to.equal(0);
    });
    cy.get('[role="dialog"]').within(() => {
      cy.contains('10/10').should('be.visible');
      cy.contains('button', 'Xem kết quả').click();
    });
    cy.get('#result-summary-title').should('have.text', '10/10');
    cy.get('[role="tab"]').contains('Xem lại bài').click();
    cy.get('[data-testid="student-review-option"][data-option-id="option-1"][data-state="correct"]')
      .should('be.visible')
      .and('contain.text', '4')
      .and('contain.text', 'Em chọn · Đúng');
  });
});
