import { QuestionType } from '../../../types';
import { getQuestionTypeDescriptor } from '../../../components/TeacherDashboard/quiz-preview/questionTypes';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import type { ManualQuizIssue } from '../validation/validationActions';

export type QuestionOverviewStatus = 'ready' | 'warning' | 'needs-fix';

export interface QuestionOverviewRow {
    id: string;
    number: number;
    label: string;
    type: string;
    points: number;
    status: QuestionOverviewStatus;
    firstIssue?: ManualQuizIssue;
}

export const getQuestionOverviewLabel = (question: ManualQuizQuestion): string => {
    const data = question as ManualQuizQuestion & { mainQuestion?: unknown; question?: unknown };
    const value = question.type === QuestionType.TRUE_FALSE ? data.mainQuestion : data.question;
    return String(value ?? '').trim() || 'Câu hỏi chưa có nội dung';
};

const getQuestionStatus = (questionIssues: ManualQuizIssue[]): QuestionOverviewStatus => {
    if (questionIssues.some((issue) => issue.severity === 'error')) return 'needs-fix';
    if (questionIssues.some((issue) => issue.severity === 'warning')) return 'warning';
    return 'ready';
};

const getFirstQuestionIssue = (questionIssues: ManualQuizIssue[]): ManualQuizIssue | undefined => (
    questionIssues.find((issue) => issue.severity === 'error')
        ?? questionIssues.find((issue) => issue.severity === 'warning')
);

export const getQuestionOverviewRows = (
    questions: ManualQuizQuestion[],
    issues: ManualQuizIssue[],
): QuestionOverviewRow[] => questions.map((question, index) => {
    const questionIssues = issues.filter((issue) => issue.questionId === question.id && issue.severity !== 'success');
    const points = Number(question.points);
    return {
        id: question.id,
        number: index + 1,
        label: getQuestionOverviewLabel(question),
        type: getQuestionTypeDescriptor(question.type)?.shortLabel ?? question.type,
        points: Number.isFinite(points) ? points : 0,
        status: getQuestionStatus(questionIssues),
        firstIssue: getFirstQuestionIssue(questionIssues),
    };
});
