import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardShellSource = readFileSync(
  resolve(process.cwd(), 'src/components/HomePage/StudentDashboardUI.tsx'),
  'utf8',
);
const dashboardControllerSource = readFileSync(
  resolve(process.cwd(), 'src/features/student-dashboard/hooks/useStudentDashboardController.ts'),
  'utf8',
);
const dashboardContentSource = readFileSync(
  resolve(process.cwd(), 'src/features/student-dashboard/components/StudentDashboardContent.tsx'),
  'utf8',
);
const dashboardBodySource = readFileSync(
  resolve(process.cwd(), 'src/features/student-dashboard/components/StudentDashboardBody.tsx'),
  'utf8',
);
const dashboardSource = [
  dashboardShellSource,
  dashboardControllerSource,
  dashboardContentSource,
  dashboardBodySource,
].join('\n');

const homePageSource = readFileSync(
  resolve(process.cwd(), 'src/components/HomePage/HomePage.tsx'),
  'utf8',
);
const stylesSource = readFileSync(resolve(process.cwd(), 'styles.css'), 'utf8');

describe('StudentDashboardUI responsive composition', () => {
  it('loads the authenticated student dashboard behind a lazy boundary', () => {
    expect(homePageSource).toContain("React.lazy(() => import('./StudentDashboardUI'))");
    expect(homePageSource).toContain('<React.Suspense');
  });

  it('keeps the page shell declarative and delegates orchestration to a controller', () => {
    expect(dashboardShellSource).toContain('useStudentDashboardController()');
    expect(dashboardShellSource).not.toContain('useClassroomStore');
    expect(dashboardShellSource).not.toContain('useHomeworkStore');
    expect(dashboardControllerSource).toContain('const studentSession = useClassroomStore');
    expect(dashboardControllerSource).toContain('const homeworkSubmission = selectedHomework');
  });

  it('uses the scoped Warm Human Education shell and desktop grid', () => {
    expect(dashboardShellSource).toContain('<StudentDashboardContent');
    expect(dashboardSource).toContain('student-dashboard');
    expect(dashboardSource).toContain('max-w-[1180px]');
    expect(dashboardSource).toContain('xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,0.9fr)]');
  });

  it('keeps assigned work before all gamification in mobile DOM order', () => {
    const assigned = dashboardSource.indexOf('<AssignedWorkSection');
    const weekly = dashboardSource.indexOf('<WeeklyQuestsPanel');
    const progress = dashboardSource.indexOf('<LearningProgressPanel');
    const rewards = dashboardSource.indexOf('<RewardSidebar');

    expect(assigned).toBeGreaterThan(-1);
    expect(assigned).toBeLessThan(weekly);
    expect(assigned).toBeLessThan(progress);
    expect(assigned).toBeLessThan(rewards);
  });

  it('wires the private result-report section and notification deep link through the controller', () => {
    expect(dashboardControllerSource).toContain('openResultReport');
    expect(dashboardControllerSource).toContain("setActiveSection('resultReports')");
    expect(dashboardContentSource).toContain('<StudentResultReportsPage');
    expect(dashboardShellSource).toContain('selectedResultReportId={controller.selectedResultReportId}');
    expect(dashboardShellSource).toContain('onOpenResultReport={controller.openResultReport}');
  });

  it('composes the expected main and sidebar regions', () => {
    const mainColumn = dashboardSource.indexOf('data-testid="student-dashboard-main-column"');
    const sideColumn = dashboardSource.indexOf('data-testid="student-dashboard-side-column"');

    expect(mainColumn).toBeGreaterThan(-1);
    expect(sideColumn).toBeGreaterThan(mainColumn);

    for (const component of [
      '<AssignedWorkSection',
      '<StudentHomeworkSection',
      '<WeeklyQuestsPanel',
      '<SubjectPracticeGrid',
    ]) {
      const index = dashboardSource.indexOf(component);
      expect(index).toBeGreaterThan(mainColumn);
      expect(index).toBeLessThan(sideColumn);
    }

    for (const component of ['<LearningProgressPanel', '<RewardSidebar']) {
      expect(dashboardSource.indexOf(component)).toBeGreaterThan(sideColumn);
    }
  });

  it('scopes reduced-motion rules to the student dashboard', () => {
    expect(stylesSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(stylesSource).toContain('.student-dashboard *');
    expect(stylesSource).toContain('animation-duration: 0.01ms !important');
    expect(stylesSource).toContain('transition-duration: 0.01ms !important');
  });
});
