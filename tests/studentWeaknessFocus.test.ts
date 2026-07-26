import { describe, expect, it } from 'vitest';
import { makeWeaknessProfileNeedsPracticeOnly, makeWeaknessProfileSuccess } from './fixtures/weaknessProfile.fixtures';
import { buildStudentWeaknessFocus } from '../src/components/student/ResultScreen/studentWeaknessFocus';

describe('buildStudentWeaknessFocus', () => {
    it('builds a targeted focus for known skills', () => {
        const profile = makeWeaknessProfileSuccess();
        const focus = buildStudentWeaknessFocus(profile.subjects[0].skills[0]);

        expect(focus).toMatchObject({
            subjectId: 'toan',
            subjectLabel: 'Toan',
            skillCode: 'phan_so',
            skillLabel: 'Phan so',
            title: 'Phan so',
            actionLabel: 'Luyen phan so',
            recommendationTitle: 'Uu tien on Phan so',
        });
        expect(focus?.recommendationSummary).toContain('Phan so');
        expect(focus?.nextStepLabel).toBe('Bat dau voi dang nay');
    });

    it('falls back to API labels when local student copy is missing', () => {
        const profile = makeWeaknessProfileSuccess();
        const focus = buildStudentWeaknessFocus({
            ...profile.subjects[0].skills[0],
            subject: 'vietnamese',
            subjectLabel: 'Tieng Viet',
            skillCode: 'ky_nang_dac_biet',
            skillLabel: 'Ky nang dac biet',
        });

        expect(focus).toMatchObject({
            subjectId: 'tieng-viet',
            subjectLabel: 'Tieng Viet',
            skillCode: 'ky_nang_dac_biet',
            title: 'Ky nang dac biet',
            actionLabel: 'Xem goi y hoc',
        });
        expect(focus?.recommendationSummary).toContain('Ky nang dac biet');
    });

    it('keeps softer copy for needs_practice skills', () => {
        const profile = makeWeaknessProfileNeedsPracticeOnly();
        const focus = buildStudentWeaknessFocus(profile.subjects[0].skills[0]);

        expect(focus).toMatchObject({
            subjectId: 'tieng-viet',
            skillCode: 'luyen_tu_va_cau',
            actionLabel: 'On luyen tu va cau',
        });
        expect(focus?.recommendationSummary).toContain('Luyen tu va cau');
    });
});
