import type { SmartAssignmentPreviewData } from '../../../../../types/classroom.types';
import { vietnamDateTimeLocalToIso } from '../../../../../utils/dateTime';

export const createSmartAssignmentComposerDraft = (
    resultId: string | number,
    preview: SmartAssignmentPreviewData,
    quizId: string,
    deadline: string,
    maxAttempts: number,
    createdAt = new Date().toISOString()
) => ({
    source: 'smart-preview' as const,
    sourceResultId: String(resultId),
    studentName: preview.student.fullName,
    className: preview.student.className,
    classId: preview.assignmentDraft.classId,
    studentId: preview.assignmentDraft.studentId,
    quizId,
    deadline: vietnamDateTimeLocalToIso(deadline),
    maxAttempts,
    weaknessSummary: {
        skillCode: preview.weaknessSummary.topSkill.skillCode,
        skillLabel: preview.weaknessSummary.topSkill.skillLabel,
        subskillCode: preview.weaknessSummary.topSkill.subskillCode,
        subskillLabel: preview.weaknessSummary.topSkill.subskillLabel,
        status: preview.weaknessSummary.topSkill.status,
        accuracy: preview.weaknessSummary.topSkill.accuracy,
        coveragePercent: preview.weaknessSummary.coveragePercent,
        targetDifficulty: preview.weaknessSummary.topSkill.targetDifficulty,
    },
    recommendedQuizzes: preview.recommendedQuizzes,
    warnings: preview.warnings,
    createdAt,
});
