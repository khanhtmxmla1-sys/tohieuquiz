import React from 'react';
import { AnnouncementComposer } from '../../src/features/notifications/admin/AnnouncementComposer';

const DESKTOP_COMPOSER_WIDTH = 596;

describe('announcement composer responsive layout', () => {
  it('keeps the content editor visible inside a narrow desktop dashboard column', () => {
    cy.viewport(1440, 1000);
    cy.mount(
      <main
        data-testid="dashboard-column"
        style={{ width: `${DESKTOP_COMPOSER_WIDTH}px` }}
      >
        <AnnouncementComposer />
      </main>,
    );

    cy.get('[data-testid="announcement-content-panel"]')
      .should('be.visible')
      .then(($panel) => {
        expect($panel[0].getBoundingClientRect().width).to.be.greaterThan(200);
      });

    cy.get('[data-testid="announcement-composer-layout"]').then(($layout) => {
      expect($layout[0].scrollWidth).to.be.lte($layout[0].clientWidth + 1);
    });
  });

  it('stacks the editor without horizontal overflow on mobile', () => {
    cy.viewport(390, 844);
    cy.mount(
      <main className="w-full p-4">
        <AnnouncementComposer />
      </main>,
    );

    cy.get('[data-testid="announcement-content-panel"]').should('be.visible');
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth)
        .to.be.lte(document.documentElement.clientWidth + 1);
    });
  });
});
