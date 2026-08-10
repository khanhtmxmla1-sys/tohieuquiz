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

const startStandardQuiz = (studentName: string) => {
  cy.visit('/', { onBeforeLoad: installQuiz });
  cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type(studentName);
  cy.get('select').select('4A1');
  cy.contains('button', 'Bắt đầu làm bài!').click();
  cy.get('#question-q1').should('be.visible');
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth);
  });
};

describe('student quiz reliability', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/system-settings*', {
      statusCode: 200,
      body: { status: 'success', data: { aiAssistantEnabled: false } },
    });
  });

  it('restores the active standard quiz and selected answer after reload', () => {
    startStandardQuiz('Học sinh kiểm thử');

    cy.get('#question-q1 button').first().click().should('have.attr', 'aria-pressed', 'true');
    cy.reload();

    cy.get('#question-q1').should('be.visible');
    cy.get('#question-q1 button').first().should('have.attr', 'aria-pressed', 'true');
    cy.contains('button', 'Bắt đầu làm bài!').should('not.exist');
  });

  [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ].forEach(({ width, height }) => {
    it(`keeps desktop navigation stationary while only questions scroll at ${width}px`, () => {
      cy.viewport(width, height);
      startStandardQuiz(`Học sinh desktop ${width}`);

      cy.get('header [role="img"], header img[alt^="Ảnh đại diện của"]')
        .should('be.visible');

      cy.get('aside[aria-label="Điều hướng bài làm"]')
        .should('be.visible')
        .then(($aside) => {
          const initialTop = $aside[0].getBoundingClientRect().top;

          cy.get('main[aria-label="Nội dung câu hỏi"]')
            .should('be.visible')
            .and('have.class', 'lg:overflow-y-auto')
            .and('have.class', '[scrollbar-width:none]')
            .then(($main) => {
              expect($main[0].scrollHeight).to.be.greaterThan($main[0].clientHeight);
            })
            .scrollTo(0, 500, { duration: 0 })
            .then(($main) => {
              expect($main[0].scrollTop).to.be.greaterThan(0);
              expect($aside[0].getBoundingClientRect().top).to.be.closeTo(initialTop, 1);
            });
        });

      cy.window().its('scrollY').should('eq', 0);

      cy.get('aside[aria-label="Điều hướng bài làm"]')
        .contains('button', 'Nộp bài')
        .should('be.visible')
        .click();
      cy.get('[role="dialog"][aria-modal="true"]').should('be.visible');
      cy.contains('button', 'Quay lại').click();

      cy.get('aside[aria-label="Điều hướng bài làm"] button[aria-label="Đi đến câu 12"]')
        .click();
      cy.contains('Trang 2 / 2').should('be.visible');
      cy.get('#question-q12').should('be.visible').and('have.focus');

      assertNoHorizontalOverflow();
    });
  });

  [
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ].forEach(({ width, height }) => {
    it(`navigates exact questions from the mobile bottom sheet without overflow at ${width}px`, () => {
      cy.viewport(width, height);
      startStandardQuiz(`Học sinh mobile ${width}`);

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

      cy.contains('button:visible', 'Nộp bài').focus().click();
      cy.get('[role="dialog"][aria-modal="true"]').should('be.visible');
      cy.focused().should('contain.text', 'Quay lại');
      cy.get('body').type('{esc}');
      cy.get('[role="dialog"]').should('not.exist');
      cy.contains('button:visible', 'Nộp bài').should('have.focus');

      assertNoHorizontalOverflow();
    });
  });
});
