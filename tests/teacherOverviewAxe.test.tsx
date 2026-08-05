// @vitest-environment jsdom
import React from 'react';
import axe from 'axe-core';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OverviewTab from '../src/components/TeacherDashboard/OverviewTab';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { useTeacherDashboardUIStore } from '../src/stores/useTeacherDashboardUIStore';

beforeEach(() => {
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
});

afterEach(() => cleanup());

describe('Teacher Overview accessibility audit', () => {
  it('has no serious or critical axe violations', async () => {
    const { container } = render(
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

    const report = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations'],
      // jsdom does not implement canvas; color contrast is audited in the real-browser Cypress spec.
      rules: { 'color-contrast': { enabled: false } },
    });
    const serious = report.violations.filter((violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
