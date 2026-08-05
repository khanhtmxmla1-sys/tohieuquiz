import React from 'react';
import axe from 'axe-core';
import OverviewTab from '../../src/components/TeacherDashboard/OverviewTab';
import { useAuthStore } from '../../stores/authStore';
import { useQuizStore } from '../../stores/quizStore';
import { useTeacherDashboardUIStore } from '../../src/stores/useTeacherDashboardUIStore';

const mountOverview = () => {
  document.documentElement.lang = 'vi';
  useAuthStore.setState({
    isLoggedIn: true,
    username: 'teacher-a',
    teacherName: 'Cô An',
    isAdmin: false,
    teacherClass: '3A',
    isLoggingIn: false,
    loginError: false,
  });
  useQuizStore.setState({ quizzes: [], results: [], error: null });
  useTeacherDashboardUIStore.setState({ activeTab: 'overview' });

  cy.mount(
    <OverviewTab
      resultsLoadState="success"
      onRetryResults={() => undefined}
      resultSummary={null}
      summaryLoadState="success"
      summaryError={null}
      onSelectTab={() => undefined}
      manualQuizWorkspaceEnabled
      onCreateQuizWithAi={() => undefined}
      onCreateQuizManually={() => undefined}
    />,
  );
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth);
  });
};

const assertNoSeriousA11yViolations = () => {
  cy.window().then(async (win) => {
    win.eval(axe.source);
    const axeWindow = win as typeof win & { axe: typeof axe };
    const report = await axeWindow.axe.run(win.document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations'],
    });
    const serious = report.violations.filter((violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).to.deep.equal([]);
  });
};

describe('Teacher Overview design-system pilot', () => {
  it('keeps the desktop layout stable', () => {
    cy.viewport(1280, 900);
    mountOverview();
    cy.contains('h1', 'Cô An').should('be.visible');
    cy.contains('h2', 'Bạn muốn làm gì?').should('be.visible');
    cy.get('button').should('have.length.at.least', 8);
    assertNoHorizontalOverflow();
    assertNoSeriousA11yViolations();
    cy.screenshot('teacher-overview-pilot-desktop', { capture: 'fullPage' });
  });

  it('keeps the mobile layout usable without horizontal overflow', () => {
    cy.viewport(390, 844);
    mountOverview();
    cy.contains('h1', 'Cô An').should('be.visible');
    cy.contains('button', 'Tạo đề bằng AI').should('be.visible');
    cy.contains('button', 'Soạn đề thủ công').should('be.visible');
    assertNoHorizontalOverflow();
    cy.screenshot('teacher-overview-pilot-mobile', { capture: 'fullPage' });
  });
});
