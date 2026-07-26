import type { WeaknessProfileResponse } from '../../src/shared/skillTaxonomy';

type SkillOverride = Partial<WeaknessProfileResponse['subjects'][number]['skills'][number]>;

function makeSkill(overrides: SkillOverride = {}) {
    return {
        subject: 'math' as const,
        subjectLabel: 'Toan',
        skillCode: 'phan_so',
        skillLabel: 'Phan so',
        attempted: 4,
        correct: 1,
        wrong: 3,
        accuracy: 25,
        status: 'weak' as const,
        ...overrides,
    };
}

function makeProfile(skills: Array<ReturnType<typeof makeSkill>>, overrides: Partial<WeaknessProfileResponse> = {}): WeaknessProfileResponse {
    return {
        studentName: 'Lan',
        studentClass: '2A',
        basedOnResultIds: ['301', '302'],
        updatedAt: '2026-04-22T10:00:00.000Z',
        subjects: [
            {
                subject: 'math',
                label: 'Toan',
                skills,
            },
        ],
        unclassifiedQuestionCount: 0,
        coveragePercent: 100,
        ...overrides,
    };
}

export function makeWeaknessProfileSuccess(): WeaknessProfileResponse {
    return makeProfile([
        makeSkill(),
        makeSkill({
            skillCode: 'toan_co_loi_van',
            skillLabel: 'Toan co loi van',
            attempted: 3,
            correct: 1,
            wrong: 2,
            accuracy: 33,
            status: 'needs_practice',
        }),
    ]);
}

export function makeWeaknessProfileWeak(): WeaknessProfileResponse {
    return makeProfile([
        makeSkill(),
        makeSkill({
            skillCode: 'phep_cong_tru',
            skillLabel: 'Phep cong tru',
            attempted: 5,
            correct: 2,
            wrong: 3,
            accuracy: 40,
            status: 'weak',
        }),
        makeSkill({
            skillCode: 'doc_hieu',
            subject: 'vietnamese',
            subjectLabel: 'Tieng Viet',
            skillLabel: 'Doc hieu',
            attempted: 4,
            correct: 2,
            wrong: 2,
            accuracy: 50,
            status: 'needs_practice',
        }),
    ]);
}

export function makeWeaknessProfileNeedsPracticeOnly(): WeaknessProfileResponse {
    return makeProfile([
        makeSkill({
            skillCode: 'luyen_tu_va_cau',
            subject: 'vietnamese',
            subjectLabel: 'Tieng Viet',
            skillLabel: 'Luyen tu va cau',
            attempted: 4,
            correct: 2,
            wrong: 2,
            accuracy: 50,
            status: 'needs_practice',
        }),
    ]);
}

export function makeWeaknessProfileLowCoverage(): WeaknessProfileResponse {
    return makeProfile(
        [makeSkill()],
        {
            coveragePercent: 62,
            unclassifiedQuestionCount: 2,
        },
    );
}

export function makeWeaknessProfileEmpty(): WeaknessProfileResponse {
    return makeProfile([
        makeSkill({
            skillCode: 'phan_so',
            skillLabel: 'Phan so',
            attempted: 4,
            correct: 3,
            wrong: 1,
            accuracy: 75,
            status: 'stable',
        }),
    ]);
}
