import React from 'react';
import { StudentFloatingSidebar } from '../../src/components/gamification/StudentFloatingSidebar';

const leaderboardResponse = {
  status: 'success',
  data: {
    topStudents: [
      { studentId: 'student-1', fullName: 'Nguyễn An', avatar: null, className: '5A', rank: 1, xu: 120 },
      { studentId: 'student-2', fullName: 'Trần Bình', avatar: null, className: '5A', rank: 2, xu: 100 },
      { studentId: 'student-3', fullName: 'Lê Chi', avatar: null, className: '5B', rank: 3, xu: 90 },
    ],
    currentStudent: {
      studentId: 'student-4',
      fullName: 'Phạm Duy',
      avatar: null,
      className: '5A',
      rank: 4,
      xu: 80,
      gapToNext: 10,
    },
    totalStudents: 4,
    period: 'week',
    scope: 'school',
    updatedAt: '2026-09-30T08:00:00.000Z',
  },
};

const interceptLeaderboard = () => {
  cy.intercept('GET', '**/api/leaderboard/student*', leaderboardResponse).as('studentLeaderboard');
};

const captureConsoleOutput = () => {
  const errors: string[] = [];
  const warnings: string[] = [];

  cy.window().then((win) => {
    cy.stub(win.console, 'error').callsFake((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
    cy.stub(win.console, 'warn').callsFake((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
  });

  return () => cy.then(() => {
    expect(errors, errors.join('\n')).to.deep.equal([]);
    expect(warnings, warnings.join('\n')).to.deep.equal([]);
  });
};

describe('Student Gold Leaderboard', () => {
  it('opens the desktop dialog and requests the weekly school leaderboard', () => {
    cy.viewport(1280, 800);
    cy.clock(Date.parse('2026-09-30T08:00:00.000Z'), ['Date']);
    interceptLeaderboard();
    const assertCleanConsole = captureConsoleOutput();

    cy.mount(<StudentFloatingSidebar />);
    cy.get('button[aria-label="Mở bảng vàng học sinh"]').should('be.visible').click();
    cy.wait('@studentLeaderboard').then(({ request }) => {
      const query = new URL(request.url).searchParams;
      expect(query.get('scope')).to.equal('school');
      expect(query.get('period')).to.equal('week');
    });
    cy.get('[role="dialog"]')
      .should('be.visible')
      .and('have.attr', 'aria-modal', 'true')
      .and('have.class', 'max-h-[85dvh]');
    cy.get('[role="dialog"]').should('contain.text', 'Bảng vàng học sinh');
    assertCleanConsole();
  });

  it('keeps the mobile leaderboard anchored as a bottom sheet with a visible FAB', () => {
    cy.viewport(390, 844);
    cy.clock(Date.parse('2026-09-30T08:00:00.000Z'), ['Date']);
    interceptLeaderboard();
    const assertCleanConsole = captureConsoleOutput();

    cy.mount(<StudentFloatingSidebar />);
    cy.get('button[aria-label="Mở bảng vàng học sinh"]').should('be.visible').click();
    cy.wait('@studentLeaderboard');
    cy.wait(500);
    cy.get('[role="dialog"]')
      .should('be.visible')
      .and('have.class', 'rounded-t-[28px]')
      .and('have.class', 'max-h-[85dvh]')
      .should(($dialog) => {
        const transform = getComputedStyle($dialog[0]).transform;
        expect(['none', 'matrix(1, 0, 0, 1, 0, 0)'], `settled transform: ${transform}`).to.include(transform);
      })
      .then(($dialog) => {
        expect($dialog[0].getBoundingClientRect().bottom).to.be.closeTo(844, 1);
      });
    assertCleanConsole();
  });
});
