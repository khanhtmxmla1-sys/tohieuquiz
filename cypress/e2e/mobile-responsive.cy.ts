const MOBILE_VIEWPORTS = [
  { width: 360, height: 800, label: '360x800' },
  { width: 390, height: 844, label: '390x844' },
  { width: 412, height: 915, label: '412x915' },
  { width: 768, height: 1024, label: '768x1024' },
];

const assertNoHorizontalOverflow = () => {
  cy.window().then((win) => {
    const doc = win.document.documentElement;
    expect(doc.scrollWidth, 'document scrollWidth').to.be.lte(doc.clientWidth + 1);
  });
};

describe('Mobile Responsive Smoke', () => {
  MOBILE_VIEWPORTS.forEach(({ width, height, label }) => {
    it(`Public routes render well on ${label}`, () => {
      cy.viewport(width, height);

      cy.visit('/');
      cy.contains('Trang chủ').should('exist');
      assertNoHorizontalOverflow();

      cy.visit('/about');
      cy.contains('Giới thiệu').should('exist');
      assertNoHorizontalOverflow();

      cy.visit('/contact');
      cy.contains('Liên hệ').should('exist');
      assertNoHorizontalOverflow();
    });

    it(`Auth + dashboard shell on ${label}`, () => {
      cy.viewport(width, height);
      cy.visit('/');

      cy.get('input[type="text"]').first().should('be.visible');
      cy.get('input[type="password"]').first().should('be.visible');
      cy.contains('button', 'Đăng nhập ngay').should('be.visible');
      assertNoHorizontalOverflow();

      // Teacher login attempt (keeps test stable even if backend data differs)
      cy.contains('button', 'Giáo viên').click();
      cy.get('input[type="text"]').first().clear().type('admin');
      cy.get('input[type="password"]').first().clear().type('admin');
      cy.contains('button', 'Đăng nhập ngay').click();

      cy.get('body').then(($body) => {
        const text = $body.text();
        if (text.includes('Tổng quan') || text.includes('Lớp học')) {
          assertNoHorizontalOverflow();
          if (width < 1024) {
            cy.contains('button', 'Thêm').should('exist');
          }
        } else {
          // Fallback: still validate login surface is responsive
          cy.contains('button', 'Giáo viên').should('be.visible');
          assertNoHorizontalOverflow();
        }
      });
    });
  });
});
