import type { SkillBreakdownItem, WeaknessProfileResponse } from '../../../../../shared/skillTaxonomy';

export const getFocusSkills = (
    profile: WeaknessProfileResponse | null
): SkillBreakdownItem[] => {
    if (!profile) return [];
    const order: Record<SkillBreakdownItem['status'], number> = {
        weak: 0,
        needs_practice: 1,
        stable: 2,
    };
    return profile.subjects
        .flatMap((subject) => subject.skills)
        .filter((skill) => skill.status === 'weak' || skill.status === 'needs_practice')
        .sort((left, right) => {
            if (order[left.status] !== order[right.status]) {
                return order[left.status] - order[right.status];
            }
            if (left.accuracy !== right.accuracy) return left.accuracy - right.accuracy;
            return left.skillLabel.localeCompare(right.skillLabel);
        })
        .slice(0, 3);
};

export const shouldShowCoverageWarning = (
    profile: Pick<WeaknessProfileResponse, 'coveragePercent' | 'unclassifiedQuestionCount'> | null
): boolean => Boolean(
    profile && (profile.coveragePercent < 80 || profile.unclassifiedQuestionCount > 0)
);

export const getSkillStatusLabel = (status: SkillBreakdownItem['status']): string => {
    if (status === 'weak') return 'Can uu tien';
    if (status === 'needs_practice') return 'Can luyen them';
    return 'On dinh';
};
