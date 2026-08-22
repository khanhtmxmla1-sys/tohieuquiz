import { describe, expect, it } from 'vitest';
import { getStudentRoute, resolveStudentSectionFromLocation } from '../src/app/navigationRoutes';

describe('student Competition route', () => {
  it('uses a stable canonical route and resolves the Competition dashboard section', () => {
    expect(getStudentRoute('competition')).toBe('/student/competition');
    expect(resolveStudentSectionFromLocation('/student/competition')).toBe('competition');
  });
});
