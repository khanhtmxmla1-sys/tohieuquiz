import React from 'react';
import { StudentFloatingSidebar } from '../../src/components/gamification/StudentFloatingSidebar';

const leaderboardResponse = {
  status: 'success',
  data: {
    topStudents: [
      { studentId: 'student-1', fullName: 'Nguyễn An', avatar: null, className: '5A', rank: 1, xu: 120 },
      { studentId: 'student-2', fullName: 'Trần Bình', avatar: null, className: '5A', rank: 2, xu: 100 },
      { studentId: 'student-3', fullName: 'Lê Chi', avatar: null, className: '5B', rank: 3, xu: 90 },
      { studentId: 'student-5', fullName: 'Nguyễn Nhật Minh', avatar: null, className: '5A', rank: 4, xu: 80 },
      { studentId: 'student-6', fullName: 'Nguyễn Hồng Đạt', avatar: null, className: '5A', rank: 5, xu: 70 },
      { studentId: 'student-7', fullName: 'Nguyễn Thị Yến Trang', avatar: null, className: '5A', rank: 6, xu: 60 },
      { studentId: 'student-8', fullName: 'Quàng Nam Chương', avatar: null, className: '5A', rank: 7, xu: 50 },
      { studentId: 'student-9', fullName: 'Vì Thị Lê Na', avatar: null, className: '5A', rank: 8, xu: 40 },
      { studentId: 'student-10', fullName: 'Hoàng Khánh Linh', avatar: null, className: '5A', rank: 9, xu: 30 },
      { studentId: 'student-11', fullName: 'Nguyễn Văn Quang', avatar: null, className: '5A', rank: 10, xu: 20 },
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
    totalStudents: 11,
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
  const openLeaderboard = () => {
    interceptLeaderboard();
    const assertCleanConsole = captureConsoleOutput();
    cy.window().then((win) => {
      const nativeMatchMedia = win.matchMedia.bind(win);
      cy.stub(win, 'matchMedia').callsFake((query: string) => {
        const mediaQuery = nativeMatchMedia(query);
        if (query.includes('prefers-reduced-motion')) {
          Object.defineProperty(mediaQuery, 'matches', { configurable: true, value: false });
        }
        return mediaQuery;
      });
    });
    cy.mount(<StudentFloatingSidebar />);
    cy.get('button[aria-label="Mở bảng vàng học sinh"]').should('be.visible').click();
    cy.wait('@studentLeaderboard');
    cy.get('[role="dialog"]').should('be.visible').and('have.attr', 'aria-modal', 'true');
    return assertCleanConsole;
  };

  for (const [width, height] of [[1366, 768], [1536, 864]] as const) {
    it(`centers a readable desktop dialog at ${width}x${height}`, () => {
      cy.viewport(width, height);
      cy.clock(Date.parse('2026-09-30T08:00:00.000Z'), ['Date']);
      const assertCleanConsole = openLeaderboard();

      cy.get('[role="dialog"]').should(($dialog) => {
        const rect = $dialog[0].getBoundingClientRect();
        expect(rect.width).to.be.closeTo(768, 1);
        expect(Math.abs((rect.left + rect.right) / 2 - width / 2)).to.be.lessThan(2);
        expect(rect.height).to.be.at.most(height * 0.82 + 1);
      });
      cy.get('[role="tablist"]').then(($tabs) => {
        expect($tabs[0].scrollWidth).to.be.at.most($tabs[0].clientWidth + 1);
      });
      assertCleanConsole();
    });
  }

  it('centers the tablet dialog at 768x1024', () => {
    cy.viewport(768, 1024);
    cy.clock(Date.parse('2026-09-30T08:00:00.000Z'), ['Date']);
    const assertCleanConsole = openLeaderboard();

    cy.get('[role="dialog"]').should(($dialog) => {
      const rect = $dialog[0].getBoundingClientRect();
      expect(rect.width).to.be.closeTo(672, 1);
      expect(Math.abs((rect.left + rect.right) / 2 - 384)).to.be.lessThan(2);
      expect(rect.height).to.be.at.most(1024 * 0.85 + 1);
    });
    cy.get('[role="tablist"]').then(($tabs) => {
      expect($tabs[0].scrollWidth).to.be.at.most($tabs[0].clientWidth + 1);
    });
    assertCleanConsole();
  });

  for (const [width, height] of [[320, 568], [390, 844]] as const) {
    it(`uses an inset mobile sheet without horizontal overflow at ${width}x${height}`, () => {
      cy.viewport(width, height);
      cy.clock(Date.parse('2026-09-30T08:00:00.000Z'), ['Date']);
      const assertCleanConsole = openLeaderboard();

      cy.get('[role="dialog"]').should(($dialog) => {
        const rect = $dialog[0].getBoundingClientRect();
        expect(rect.left).to.be.closeTo(8, 1);
        expect(rect.right).to.be.closeTo(width - 8, 1);
        expect(rect.bottom).to.be.closeTo(height - 8, 1);
        expect(rect.height).to.be.at.most(height - 16 + 1);
      });
      cy.get('[role="tablist"]').then(($tabs) => {
        expect($tabs[0].scrollWidth).to.be.at.most($tabs[0].clientWidth + 1);
      });
      cy.get('[role="tab"]').should(($tabs) => {
        $tabs.each((_, tab) => {
          expect(tab.getBoundingClientRect().height).to.be.at.least(44);
        });
      });
      cy.get('#student-leaderboard-panel').scrollTo('bottom');
      cy.get('[role="tablist"]').should('be.visible');
      cy.get('#student-leaderboard-panel').should(($panel) => {
        expect($panel[0].scrollHeight).to.be.greaterThan($panel[0].clientHeight);
      });
      cy.document().then((doc) => {
        expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1);
      });
      assertCleanConsole();
    });
  }
});
