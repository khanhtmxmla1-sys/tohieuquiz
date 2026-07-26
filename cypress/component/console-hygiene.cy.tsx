import React from 'react';
import { MathJaxContext } from 'better-react-mathjax';
import { mathJaxConfig } from '../../src/config/mathJaxConfig';
import MathSpan from '../../src/components/common/MathSpan';
import LoginForm from '../../src/components/HomePage/components/LoginForm';

describe('production console hygiene contracts', () => {
  it('typesets AMS math without component-version warnings', () => {
    const warnings: string[] = [];

    cy.window().then((win) => {
      cy.stub(win.console, 'warn').callsFake((...args: unknown[]) => {
        warnings.push(args.map(String).join(' '));
      });
    });

    cy.mount(
      <MathJaxContext config={mathJaxConfig}>
        <MathSpan content={String.raw`$\frac{a^2+b^2}{2}$`} />
      </MathJaxContext>,
    );

    cy.get('mjx-container', { timeout: 30_000 }).should('be.visible');
    cy.get('mjx-merror').should('not.exist');
    cy.then(() => {
      expect(warnings.some((message) => (
        message.includes('No version information available for component')
      ))).to.equal(false);
    });
  });

  it('renders login fields with autocomplete metadata', () => {
    cy.mount(
      <LoginForm
        activeTab="teacher"
        setActiveTab={() => undefined}
        username=""
        setUsername={() => undefined}
        password=""
        setPassword={() => undefined}
        isLoading={false}
        onSubmit={(event) => event.preventDefault()}
      />,
    );

    cy.get('input[type="text"]')
      .should('have.attr', 'autocomplete', 'username');
    cy.get('input[type="password"]')
      .should('have.attr', 'autocomplete', 'current-password');
  });
});
