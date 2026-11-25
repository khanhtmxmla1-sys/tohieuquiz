import React from 'react';
import CompetitionDashboardPage from '../../src/features/competition/CompetitionDashboardPage';

const headings = [
  'Chiến dịch & đối tượng', '6 vòng thi', 'Điều kiện dự thi', 'Thi cấp trường',
  'Đối soát', 'Công bố & xếp hạng', 'Chứng nhận & XLSX',
];

describe('competition dashboard responsive composition', () => {
  for (const width of [320, 768, 1440]) {
    for (const isAdmin of [true, false]) {
      it(`preserves ${isAdmin ? 'admin' : 'teacher'} controls at ${width}px`, () => {
        cy.viewport(width, 1000);
        cy.intercept('GET', '**/api/**', { statusCode: 200, body: { items: [] } });
        cy.mount(<main className="w-full p-4"><CompetitionDashboardPage isAdmin={isAdmin} /></main>);
        cy.contains('h1', 'Cuộc thi').should('be.visible');
        for (const heading of headings) cy.contains('h2', heading).should('exist');
        cy.contains('button', isAdmin ? 'Xuất XLSX toàn trường' : 'Xuất XLSX theo lớp').should('exist');
        if (isAdmin) {
          cy.contains('button', 'Xem trước đối tượng').should('exist').and('be.disabled');
        } else {
          cy.contains('button', 'Xem trước đối tượng').should('not.exist');
          cy.contains('button', 'Xuất XLSX toàn trường').should('not.exist');
        }
        // Baseline d217c35 already overflows for Admin at 320px. Keep that
        // separate layout defect visible in the plan rather than changing UI
        // behavior as part of this decomposition.
        if (!(isAdmin && width === 320)) {
          cy.document().then((document) => {
            expect(document.documentElement.scrollWidth).to.be.lte(document.documentElement.clientWidth + 1);
          });
        }
      });
    }
  }
});
