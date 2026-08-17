import { describe, expect, it } from 'vitest';
import type { StudentResult } from '../src/types';
import { filterTeacherResults } from '../src/components/TeacherDashboard/teacher-dashboard-shell/dashboardSelectors';

const results = [
  { id: 1, studentClass: 'Lớp 4A' },
  { id: 2, studentClass: '5B' },
  { id: 3, studentClass: '6C' },
] as StudentResult[];

describe('teacher dashboard canonical class scope', () => {
  it('keeps results from every class assigned to a teacher', () => {
    const scoped = filterTeacherResults(results, false, [
      { id: 'class-4a', name: '4A' },
      { id: 'class-5b', name: '5B' },
    ]);

    expect(scoped.map((result) => result.id)).toEqual([1, 2]);
  });

  it('fails closed when a non-admin teacher has no canonical or legacy class scope', () => {
    expect(filterTeacherResults(results, false, [], null)).toEqual([]);
  });

  it('keeps school-wide results for administrators', () => {
    expect(filterTeacherResults(results, true, [])).toEqual(results);
  });
});
