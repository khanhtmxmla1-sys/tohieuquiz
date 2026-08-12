/// <reference types="cypress" />

const QUIZ_ID = 'categorization-responsive';

const quiz = {
  id: QUIZ_ID,
  title: 'Kiểm tra phân loại responsive',
  classLevel: '4',
  category: 'kiem-thu',
  timeLimit: 30,
  requireCode: false,
  isPractice: true,
  questions: [
    {
      id: 'category-responsive',
      quizId: QUIZ_ID,
      type: 'CATEGORIZATION',
      question: 'Phân loại các cách nhân hoá sau vào nhóm phù hợp.',
      categories: [
        { id: 'call', name: 'Dùng từ gọi người để gọi vật' },
        { id: 'action', name: 'Dùng từ tả hoạt động/đặc điểm của người để tả vật' },
        { id: 'talk', name: 'Trò chuyện với vật như với người' },
      ],
      items: [
        { id: 'i1', content: 'Ông em rất thích đọc báo.', categoryId: 'call' },
        { id: 'i2', content: 'Trời tối, bác thợ rèn trở về trong ngôi nhà.', categoryId: 'action' },
        { id: 'i3', content: 'Bác mèo mướp nằm sưởi nắng bên hiên.', categoryId: 'call' },
        { id: 'i4', content: 'Những chiếc lá nhỏ trò chuyện vui vẻ với gió.', categoryId: 'talk' },
      ],
    },
  ],
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

const startQuiz = () => {
  cy.intercept('GET', '**/api/system-settings*', {
    statusCode: 200,
    body: { status: 'success', data: { aiAssistantEnabled: false } },
  });

  cy.visit('/', { onBeforeLoad: installQuiz });
  cy.contains('Kiểm tra phân loại responsive', { timeout: 15_000 }).should('be.visible');
  cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh kiểm thử');
  cy.get('select').select('4A1');
  cy.contains('button', 'Bắt đầu làm bài!').click();
  cy.get('#question-category-responsive', { timeout: 15_000 }).should('be.visible');
};

describe('Student categorization responsive UI', () => {
  it('keeps long content readable and interaction compact on a 390px viewport', () => {
    cy.viewport(390, 844);
    startQuiz();

    cy.get('#question-category-responsive').within(() => {
      cy.contains('Đã làm 0/4').should('be.visible');
      cy.contains('Danh sách chưa phân loại').should('not.exist');
      cy.contains('Chưa có mục nào').should('not.exist');

      cy.contains('Ông em rất thích đọc báo.')
        .should('be.visible')
        .then(($text) => {
          const textContainer = $text[0].parentElement;
          expect(textContainer, 'text container').not.to.be.null;
          const textRect = textContainer!.getBoundingClientRect();
          expect(textRect.width).to.be.greaterThan(250);
        });

      cy.contains('Ông em rất thích đọc báo.')
        .closest('article')
        .should('be.visible')
        .within(() => {
          cy.get('button[aria-label^="Chọn nhóm"]').should('have.length', 3);
          cy.get('button[aria-label="Chọn nhóm Dùng từ gọi người để gọi vật cho Ông em rất thích đọc báo."]')
            .should('be.visible')
            .click();
        });

      cy.contains('Đã làm 1/4').should('be.visible');
      cy.get('[aria-label="Đã chọn nhóm Dùng từ gọi người để gọi vật"]')
        .should('be.visible')
        .and('contain.text', 'Dùng từ gọi người để gọi vật');

      cy.get('button[aria-label="Đổi nhóm cho Ông em rất thích đọc báo."]')
        .should('be.visible')
        .click();
      cy.get('button[aria-label="Chọn nhóm Trò chuyện với vật như với người cho Ông em rất thích đọc báo."]')
        .should('be.visible')
        .click();
      cy.get('[aria-label="Đã chọn nhóm Trò chuyện với vật như với người"]')
        .should('be.visible');
    });

    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth);
    });
  });

  it('keeps the same compact card interaction on desktop', () => {
    cy.viewport(1280, 800);
    startQuiz();

    cy.get('#question-category-responsive').within(() => {
      cy.contains('Đã làm 0/4').should('be.visible');
      cy.get('article').should('have.length', 4);
      cy.contains('Ông em rất thích đọc báo.')
        .closest('article')
        .within(() => {
          cy.get('button[aria-label^="Chọn nhóm"]').should('have.length', 3);
        });
    });
  });
});
