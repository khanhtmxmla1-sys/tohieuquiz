/// <reference types="cypress" />

const standardQuiz = {
  id: 'student-reliability-standard',
  title: 'Kiểm tra độ bền phiên làm bài',
  classLevel: '4',
  category: 'audit',
  timeLimit: 30,
  requireCode: false,
  isPractice: false,
  questions: Array.from({ length: 12 }, (_, index) => ({
    id: `q${index + 1}`,
    quizId: 'student-reliability-standard',
    type: 'MCQ',
    question: `Câu hỏi số ${index + 1}`,
    options: ['A', 'B'],
    correctAnswer: 'A',
  })),
};

const installQuiz = (win: Window) => {
  win.Math.random = () => 0.999999;
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'student',
      quizzes: [standardQuiz],
      selectedQuiz: standardQuiz,
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};

describe('student quiz reliability', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/system-settings*', {
      statusCode: 200,
      body: { status: 'success', data: { aiAssistantEnabled: false } },
    });
  });

  it('restores the active standard quiz and selected answer after reload', () => {
    cy.visit('/', { onBeforeLoad: installQuiz });
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh kiểm thử');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();

    cy.get('#question-q1 button').first().click().should('have.attr', 'aria-pressed', 'true');
    cy.reload();

    cy.get('#question-q1').should('be.visible');
    cy.get('#question-q1 button').first().should('have.attr', 'aria-pressed', 'true');
    cy.contains('button', 'Bắt đầu làm bài!').should('not.exist');
  });

  it('navigates exact questions from the mobile bottom sheet without horizontal overflow', () => {
    cy.viewport(390, 844);
    cy.visit('/', { onBeforeLoad: installQuiz });
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh mobile');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();

    cy.get('button[aria-label="Mở danh sách câu hỏi"]:visible').focus().click();
    cy.get('[role="dialog"][aria-modal="true"]').should('be.visible').within(() => {
      cy.get('button[aria-label="Đi đến câu 12"]').click();
    });
    cy.contains('Trang 2 / 2').should('be.visible');
    cy.get('#question-q12').should('be.visible').and('have.focus');

    cy.get('button[aria-label="Mở danh sách câu hỏi"]:visible').focus().click();
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('button[aria-label="Mở danh sách câu hỏi"]:visible').should('have.focus');

    cy.contains('button', 'Nộp bài').focus().click();
    cy.get('[role="dialog"][aria-modal="true"]').should('be.visible');
    cy.focused().should('contain.text', 'Quay lại');
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('button', 'Nộp bài').should('have.focus');

    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth);
    });
  });
});
