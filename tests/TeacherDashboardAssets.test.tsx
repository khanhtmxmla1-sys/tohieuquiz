import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import TeacherDashboardVisual, {
  TEACHER_DASHBOARD_VISUALS,
  type TeacherDashboardVisualName,
} from '../src/components/TeacherDashboard/overview/TeacherDashboardVisual';

const visualNames: TeacherDashboardVisualName[] = [
  'teacher-welcome',
  'ai-quiz-robot',
  'manual-quiz',
  'classroom',
  'test',
  'quiz-create',
  'assignment',
  'live-exam',
  'results',
  'certificate',
  'quiz-management',
  'students',
];

describe('teacher dashboard visual assets', () => {
  it.each(visualNames)('registers %s with an existing optimized WebP asset', (name) => {
    const visual = TEACHER_DASHBOARD_VISUALS[name];
    const absolutePath = resolve(process.cwd(), 'public', visual.src.replace(/^\//, ''));

    expect(visual.src).toMatch(/^\/(icons|illustrations)\/tohieuquiz\/.*\.webp$/);
    expect(visual.width).toBeGreaterThan(0);
    expect(visual.height).toBeGreaterThan(0);
    expect(visual.maxBytes).toBeGreaterThan(0);
    expect(existsSync(absolutePath), absolutePath).toBe(true);
    expect(statSync(absolutePath).size).toBeLessThanOrEqual(visual.maxBytes);
  });

  it('keeps the generated manifest in sync with the emitted files', () => {
    const manifestPath = resolve(
      process.cwd(),
      'public/icons/tohieuquiz/dashboard-v2/manifest.json',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      assets: Array<{ name: string; bytes: number; sha256: string }>;
    };

    expect(manifest.assets).toHaveLength(11);
    for (const asset of manifest.assets) {
      expect(asset.bytes).toBeGreaterThan(0);
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('uses fixed dimensions, decorative semantics and a stable fallback', () => {
    render(
      <TeacherDashboardVisual
        name="ai-quiz-robot"
        decorative
        className="visual-test"
      />,
    );

    const image = screen.getByRole('presentation', { hidden: true });
    expect(image).toHaveAttribute('width', String(TEACHER_DASHBOARD_VISUALS['ai-quiz-robot'].width));
    expect(image).toHaveAttribute('height', String(TEACHER_DASHBOARD_VISUALS['ai-quiz-robot'].height));
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('decoding', 'async');

    fireEvent.error(image);
    expect(screen.getByTestId('teacher-dashboard-visual-fallback')).toHaveClass('visual-test');
  });

  it('exposes meaningful alt text for non-decorative visuals', () => {
    render(
      <TeacherDashboardVisual
        name="students"
        decorative={false}
        alt="Nhóm học sinh trong lớp"
      />,
    );

    expect(screen.getByRole('img', { name: 'Nhóm học sinh trong lớp' })).toBeInTheDocument();
  });
});
