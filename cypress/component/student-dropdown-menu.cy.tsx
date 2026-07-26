import React, { useState } from 'react';
import { MathJaxContext } from 'better-react-mathjax';
import QuestionRenderer from '../../src/features/quiz-player/components/QuestionRenderer';
import { QuestionType, type Question } from '../../src/types';
import { mathJaxConfig } from '../../src/config/mathJaxConfig';

const question = {
  id: 'dropdown-overflow',
  type: QuestionType.DROPDOWN,
  question: 'Chọn công thức đúng để tính diện tích xung quanh của hình lập phương có cạnh là a:',
  text: 'Công thức tính diện tích xung quanh hình lập phương là [1].',
  blanks: [{
    id: '1',
    options: ['$4a^2$', '$6a^2$', '$a^3$', '$12a^2$'],
    correctAnswer: '$4a^2$',
  }],
} as Question;

const Harness = () => {
  const [answers, setAnswers] = useState<Record<string, any>>({});

  return (
    <MathJaxContext config={mathJaxConfig}>
      <main
        data-testid="dropdown-viewport-harness"
        style={{ position: 'fixed', top: '390px', left: '20px', right: '20px' }}
      >
        <QuestionRenderer
          question={question}
          index={6}
          answers={answers}
          onAnswerChange={(questionId, value, blankId) => {
            setAnswers((current) => ({
              ...current,
              [questionId]: {
                ...(current[questionId] || {}),
                [blankId!]: value,
              },
            }));
          }}
        />
        <output data-testid="selected-answer">
          {answers['dropdown-overflow']?.['1'] || ''}
        </output>
      </main>
    </MathJaxContext>
  );
};

describe('student LaTeX dropdown menu', () => {
  it('escapes the clipped question shell, stays in the viewport and selects an answer', () => {
    cy.viewport(1000, 650);
    cy.mount(<Harness />);

    cy.get('button[aria-haspopup="listbox"]')
      .should('be.visible')
      .then(($trigger) => {
        cy.wrap($trigger).click();

        cy.get('[role="listbox"]')
          .should('be.visible')
          .should(($menu) => {
            const triggerRect = $trigger[0].getBoundingClientRect();
            const menuRect = $menu[0].getBoundingClientRect();
            expect($menu.closest('.question-renderer-shell')).to.have.length(0);
            expect($menu[0].parentElement).to.equal(Cypress.$('body')[0]);
            expect(menuRect.top).to.be.gte(8);
            expect(menuRect.left).to.be.gte(8);
            expect(menuRect.right).to.be.lte(992);
            expect(menuRect.bottom).to.be.lte(642);
            expect(menuRect.bottom).to.be.lte(triggerRect.top + 1);
          });
      });

    cy.get('[role="option"]')
      .should('have.length', 4)
      .each(($option) => {
        cy.wrap($option).find('mjx-container').should('be.visible');
      });
    cy.get('[role="option"]').first().click();
    cy.get('[data-testid="selected-answer"]').should('have.text', '$4a^2$');
    cy.get('[role="listbox"]').should('not.exist');
    cy.get('button[aria-haspopup="listbox"]').should('have.attr', 'aria-expanded', 'false');
  });
});
