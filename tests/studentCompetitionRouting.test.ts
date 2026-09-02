import { describe, expect, it } from 'vitest';
import { getStudentRoute, resolveStudentSectionFromLocation } from '../src/app/navigationRoutes';

describe('student Competition route', () => {
  it('keeps the legacy compatibility route while building canonical campaign URLs from server slugs', () => {
    expect(getStudentRoute('competition')).toBe('/student/competition');
    expect(getStudentRoute('competition', { campaignSlug: 'campaign a' } as any)).toBe('/thi/campaign%20a');
    expect(resolveStudentSectionFromLocation('/student/competition')).toBe('competition');
    expect(resolveStudentSectionFromLocation('/thi/campaign-a')).toBe('competition');
  });
});
