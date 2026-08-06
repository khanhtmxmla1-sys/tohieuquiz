import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const overviewFiles = [
  'src/components/TeacherDashboard/OverviewTab.tsx',
  'src/components/TeacherDashboard/overview/DashboardHero.tsx',
  'src/components/TeacherDashboard/overview/DashboardKpiGrid.tsx',
  'src/components/TeacherDashboard/overview/MetricGrid.tsx',
  'src/components/TeacherDashboard/overview/QuickActionGrid.tsx',
  'src/components/TeacherDashboard/overview/QuizCreationChoicePanel.tsx',
  'src/components/TeacherDashboard/overview/TeacherDashboardVisual.tsx',
  'src/components/TeacherDashboard/overview/dashboardVisualConfig.ts',
  'src/components/TeacherDashboard/quiz-creation/QuizCreationActions.tsx',
];

describe('Teacher Overview design-system pilot', () => {
  it('uses common primitives or semantic design tokens in the pilot surface', () => {
    const sources = overviewFiles.map((file) => readFileSync(resolve(process.cwd(), file), 'utf8')).join('\n');
    expect(sources).toMatch(/<Card|<Button|<Skeleton|var\(--color-/);
  });

  it('does not add raw hexadecimal colors to the pilot files', () => {
    for (const file of overviewFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
