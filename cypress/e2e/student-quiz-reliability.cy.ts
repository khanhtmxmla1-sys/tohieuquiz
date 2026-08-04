/// <reference types="cypress" />

const standardQuiz = {
  id: 'student-reliability-standard',
  title: 'Kiểm tra độ bền phiên làm bài',
  classLevel: '4',
  category: 'audit',
  timeLimit: 30,
  requireCode: false,
  isPractice: false,
  questions: [{
    id: 'q1',
    quizId: 'student-reliability-standard',
    type: 'MCQ',
    question: 'Đáp án nào là A?',
    options: ['A', 'B'],
    correctAnswer: 'A',
  }],
};

const installQuiz = (win: Window) => {
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
});
