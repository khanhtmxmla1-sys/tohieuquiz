import type { Quiz } from '../../../types';
import { validateQuestionForAuthoring } from './questionValidators';
import {
    createQuizIssue,
    normalizeAuthoringText,
    type ManualQuizIssue,
    type ManualQuizIssueAction,
    type ManualQuizIssueSeverity,
} from './validationActions';

export interface ValidationContext {
    targetPoints?: number;
    maxRecommendedTimeMinutes?: number;
}

export type {
    ManualQuizIssue,
    ManualQuizIssueAction,
    ManualQuizIssueSeverity,
} from './validationActions';

export const validateManualQuiz = (
    quiz: Quiz,
    context: ValidationContext = {},
): ManualQuizIssue[] => {
    const issues: ManualQuizIssue[] = [];
    const title = normalizeAuthoringText(quiz.title);
    if (!title) {
        issues.push(createQuizIssue('QUIZ_TITLE_REQUIRED', 'error', 'Hãy nhập tên đề kiểm tra.'));
    } else {
        issues.push(createQuizIssue('QUIZ_TITLE_READY', 'success', 'Tên đề đã sẵn sàng.'));
    }

    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (questions.length === 0) {
        issues.push(createQuizIssue('QUIZ_QUESTIONS_REQUIRED', 'error', 'Đề cần ít nhất một câu hỏi.'));
    } else {
        issues.push(createQuizIssue('QUIZ_QUESTIONS_READY', 'success', `Đã có ${questions.length} câu hỏi.`));
    }

    const timeLimit = Number(quiz.timeLimit);
    if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
        issues.push(createQuizIssue('QUIZ_TIME_INVALID', 'error', 'Thời gian làm bài phải lớn hơn 0 phút.', {
            action: 'fix-time',
        }));
    } else {
        issues.push(createQuizIssue('QUIZ_TIME_READY', 'success', `Thời gian làm bài: ${timeLimit} phút.`));
        const maxRecommended = context.maxRecommendedTimeMinutes ?? 180;
        if (timeLimit > maxRecommended) {
            issues.push(createQuizIssue('QUIZ_TIME_LONG', 'warning', 'Thời gian làm bài đang dài hơn mức thường dùng.', {
                action: 'fix-time',
            }));
        }
    }

    for (const question of questions) {
        issues.push(...validateQuestionForAuthoring(question));
    }

    const totalPoints = questions.reduce((total, question) => {
        const points = Number((question as any).points);
        return total + (Number.isFinite(points) && points > 0 ? points : 0);
    }, 0);
    const targetPoints = Number(context.targetPoints ?? 10);
    if (questions.length > 0 && Number.isFinite(targetPoints) && targetPoints > 0) {
        if (Math.abs(totalPoints - targetPoints) > 0.001) {
            issues.push(createQuizIssue(
                'QUIZ_POINTS_MISMATCH',
                'warning',
                `Tổng điểm hiện là ${totalPoints}, chưa khớp mục tiêu ${targetPoints}.`,
                { action: 'fix-points' },
            ));
        } else {
            issues.push(createQuizIssue('QUIZ_POINTS_READY', 'success', `Tổng điểm đã đủ ${targetPoints}.`));
        }
    }

    return issues;
};

export const hasBlockingManualQuizIssues = (issues: ManualQuizIssue[]): boolean =>
    issues.some((issue) => issue.severity === 'error');

export const summarizeManualQuizIssues = (issues: ManualQuizIssue[]) => ({
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
    successCount: issues.filter((issue) => issue.severity === 'success').length,
});
