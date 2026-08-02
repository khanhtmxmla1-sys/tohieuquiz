/// <reference types="cypress" />

import { gradeQuiz } from '../../src/domain/quiz-scoring';

const QUIZ_ID = 'scoring-matrix-14';

const questions = [
  { id: 'mcq', quizId: QUIZ_ID, type: 'MCQ', question: 'Chọn số bốn.', options: ['2', '4', '6'], correctAnswer: 'B' },
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

const withinQuestion = (id: string, callback: () => void) => {
  cy.get(`#question-${id}`, { timeout: 15_000 }).should('be.visible').within(callback);
};

describe('Canonical scoring browser matrix', () => {
  it('submits correct renderer payloads for all 14 published question types', () => {
    cy.intercept('GET', '**/api/system-settings*', {
      statusCode: 200,
      body: { status: 'success', data: { aiAssistantEnabled: false } },
    });

    cy.intercept('POST', '**/api/validate', (request) => {
      const grading = gradeQuiz({ questions }, request.body.answers ?? {});
      expect(grading.issues, JSON.stringify(grading.details)).to.deep.equal([]);
      expect(grading.correctCount, JSON.stringify(grading.details)).to.equal(14);
      expect(grading.score).to.equal(10);

      request.reply({
        statusCode: 200,
        body: {
          status: 'success',
          score: grading.score,
          correctCount: grading.correctCount,
          total: grading.totalQuestions,
          gradingVersion: grading.engineVersion,
          details: grading.details.map((detail) => ({
            questionId: detail.questionId,
            isCorrect: detail.isCorrect,
            status: detail.status,
            issueCode: detail.issueCode,
          })),
        },
      });
    }).as('validateAnswers');

    cy.visit('/', { onBeforeLoad: installQuiz });
    cy.contains('Ma trận chấm điểm 14 dạng câu hỏi', { timeout: 15_000 }).should('be.visible');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh kiểm thử');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();

    withinQuestion('mcq', () => cy.get('button').eq(1).click());
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
      cy.get('button').eq(0).click();
      cy.get('button').eq(2).click();
      cy.get('button').eq(1).click();
      cy.get('button').eq(3).click();
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

    cy.contains('button', 'Câu tiếp theo').last().click();
    cy.contains('Trang 2 / 2').should('be.visible');

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

    cy.wait('@validateAnswers').its('request.body.answers').should((answers) => {
      expect(Object.keys(answers)).to.have.length(14);
    });
    cy.get('[role="dialog"]').within(() => {
      cy.contains('10/10').should('be.visible');
      cy.contains('14/14 câu đúng').should('be.visible');
      cy.contains('button', 'Xem kết quả').click();
    });
    cy.get('#result-summary-title').should('have.text', '10/10');
    cy.contains('14 đúng · 0 sai · 0 chưa làm').should('be.visible');
  });
});
