import { describe, expect, it } from 'vitest';
import { normalizeTeacherDashboardTab } from '../src/stores/useTeacherDashboardUIStore';

describe('teacher dashboard tab migration', () => {
  it('keeps active dashboard tabs unchanged', () => {
    expect(normalizeTeacherDashboardTab('results')).toBe('results');
    expect(normalizeTeacherDashboardTab('personal-settings')).toBe('personal-settings');
  });

  it('moves removed or malformed tabs back to overview', () => {
    expect(normalizeTeacherDashboardTab('ioe')).toBe('overview');
    expect(normalizeTeacherDashboardTab('ioe-manage')).toBe('overview');
    expect(normalizeTeacherDashboardTab('ioe-results')).toBe('overview');
    expect(normalizeTeacherDashboardTab(null)).toBe('overview');
  });
});
