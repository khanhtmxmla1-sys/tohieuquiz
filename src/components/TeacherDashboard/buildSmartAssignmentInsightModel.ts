import type { Quiz } from '../../types';
import type { AssignmentComposerDraft } from '../../stores/useTeacherDashboardUIStore';
import type { SmartAssignmentRecommendedQuiz, SmartAssignmentWarning } from '../../types/classroom.types';
import type {
    InterventionDecisionState,
    SmartAssignmentInsightViewModel,
} from './SmartAssignmentInsightCard';

type BuildSmartAssignmentInsightModelArgs = {
    activeDraft: AssignmentComposerDraft | null;
    quizzes: Quiz[];
    selectedQuizId: string;
    selectedClassId: string;
    selectedStudentId: string;
    selectedRecommendedQuiz?: SmartAssignmentRecommendedQuiz;
    draftWarnings: SmartAssignmentWarning[];
    manualNotice: string | null;
    tagsFallbackMessage: string;
};

const getDifficultyLabel = (difficulty?: number) => {
    if (difficulty === 1) return 'De';
    if (difficulty === 2) return 'Trung binh';
    if (difficulty === 3) return 'Kho';
    return 'Chua ro';
};

const getWeaknessStatusLabel = (status?: AssignmentComposerDraft['weaknessSummary']['status']) => {
    if (status === 'weak') return 'Can uu tien';
    if (status === 'needs_practice') return 'Can luyen them';
    return 'On dinh';
};

export function buildSmartAssignmentInsightModel({
    activeDraft,
    quizzes,
    selectedQuizId,
    selectedClassId,
    selectedStudentId,
    selectedRecommendedQuiz,
    draftWarnings,
    manualNotice,
    tagsFallbackMessage,
}: BuildSmartAssignmentInsightModelArgs): SmartAssignmentInsightViewModel | null {
    if (!activeDraft) {
        return null;
    }

    const weaknessSummary = activeDraft.weaknessSummary;
    const fallbackRecommendation = activeDraft.recommendedQuizzes?.[0];
    const currentQuiz = quizzes.find((quiz) => quiz.id === selectedQuizId);
    const confidence = selectedRecommendedQuiz?.confidence;
    const coveragePercent = weaknessSummary?.coveragePercent;
    const isMissingRecommendedSelection = !selectedQuizId;
    const isManualAdjusted =
        !isMissingRecommendedSelection && (
            selectedQuizId !== activeDraft.quizId ||
        selectedClassId !== activeDraft.classId ||
        (selectedStudentId || '') !== (activeDraft.studentId || '')
        );
    const recommendationUsesTagsFallback = Boolean(selectedRecommendedQuiz?.matchBreakdown.matchedViaTags);

    const warningMessages = draftWarnings.map((warning) => warning.message);
    if (recommendationUsesTagsFallback) {
        warningMessages.push(tagsFallbackMessage);
    }
    if (typeof coveragePercent === 'number' && coveragePercent < 60) {
        warningMessages.push('Do phu metadata duoi 60%, thay co nen xem nhanh de bai truoc khi giao.');
    } else if (typeof coveragePercent === 'number' && coveragePercent < 80) {
        warningMessages.push(`Do phu metadata hien tai la ${coveragePercent}%, nen xem lai nhanh truoc khi giao.`);
    }
    if (typeof confidence === 'number' && confidence < 0.6) {
        warningMessages.push('Goi y nay co do tin cay thap, nen duoc teacher xem lai truoc khi giao.');
    }

    const uniqueWarningMessages = Array.from(new Set(warningMessages));
    let state: InterventionDecisionState = 'recommended';
    if (isMissingRecommendedSelection) {
        state = 'review';
    } else if (isManualAdjusted) {
        state = 'manual-adjusted';
    } else if ((typeof confidence === 'number' && confidence < 0.6) || (typeof coveragePercent === 'number' && coveragePercent < 60)) {
        state = 'low-confidence';
    } else if (uniqueWarningMessages.length > 0) {
        state = 'review';
    }

    const currentRecommendation = selectedRecommendedQuiz || fallbackRecommendation;
    const targetDifficulty = selectedRecommendedQuiz?.matchBreakdown.targetDifficulty ?? weaknessSummary?.targetDifficulty;
    const targetDifficultyLabel = targetDifficulty
        ? `Muc muc tieu ${targetDifficulty} - ${getDifficultyLabel(targetDifficulty)}`
        : undefined;

    let summary = 'He thong da nap goi y giao bai dua tren ket qua gan day cua hoc sinh.';
    if (isMissingRecommendedSelection) {
        summary = 'De goi y ban dau khong con kha dung. Thay co vui long chon lai de bai truoc khi giao.';
    } else if (state === 'manual-adjusted') {
        summary = 'Ban da chinh de bai hoac doi tuong khac so voi goi y ban dau. He thong giu lai muc tieu ky nang de thay co doi chieu.';
    } else if (state === 'low-confidence') {
        summary = 'Goi y nay can teacher xem lai ky hon vi du lieu ho tro chua du manh.';
    } else if (state === 'review') {
        summary = 'Goi y nay van kha hop ly, nhung co mot vai dau hieu can xem lai truoc khi giao.';
    } else if (currentRecommendation) {
        summary = `Nen giao de "${currentRecommendation.title}" de luyen ${weaknessSummary?.skillLabel || 'ky nang uu tien'}.`;
    }

    return {
        state,
        source: activeDraft.source,
        title: 'Intervention summary',
        summary,
        skillLabel: weaknessSummary?.skillLabel,
        subskillLabel: weaknessSummary?.subskillLabel,
        statusLabel: getWeaknessStatusLabel(weaknessSummary?.status),
        accuracy: weaknessSummary?.accuracy,
        targetDifficultyLabel,
        matchReason: selectedRecommendedQuiz?.matchReason,
        confidencePercent: typeof confidence === 'number' ? Math.round(confidence * 100) : undefined,
        className: activeDraft.className,
        studentName: activeDraft.studentName,
        quizTitle: currentQuiz?.title || currentRecommendation?.title,
        warningMessages: uniqueWarningMessages,
        manualNotice,
    };
}
