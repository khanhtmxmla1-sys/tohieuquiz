import React from 'react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router';
import DesignSystemPage from '../../src/components/design-system/DesignSystemPage';

const mountPage = () => cy.mount(<MemoryRouter><DesignSystemPage /></MemoryRouter>);

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth);
  });
};

describe('Design System icon gallery', () => {
  [320, 768, 1024, 1440].forEach((width) => {
    it(`renders without overflow at ${width}px`, () => {
      cy.viewport(width, 900);
      mountPage();
      cy.get('[data-module-icon]').should('have.length', 36);
      assertNoHorizontalOverflow();
    });
  });

  it('has no serious accessibility violations', () => {
    cy.viewport(1280, 900);
    mountPage();
    cy.document().then((document) => document.documentElement.setAttribute('lang', 'vi'));
    cy.window().then(async (win) => {
      win.eval(axe.source);
      const axeWindow = win as typeof win & { axe: typeof axe };
      const report = await axeWindow.axe.run(win.document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      });
      const serious = report.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical');
      expect(serious, JSON.stringify(serious, null, 2)).to.deep.equal([]);
    });
  });
});
