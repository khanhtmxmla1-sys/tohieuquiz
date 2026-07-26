export type ManualQuizIssueSeverity = 'error' | 'warning' | 'success';
export type ManualQuizIssueAction =
    | 'go-to-question'
    | 'fix-points'
    | 'fix-time'
    | 'retry-media';

export interface ManualQuizIssue {
    code: string;
    severity: ManualQuizIssueSeverity;
    message: string;
    questionId?: string;
    field?: string;
    action?: ManualQuizIssueAction;
}

export const createQuizIssue = (
    code: string,
    severity: ManualQuizIssueSeverity,
    message: string,
    details: Omit<ManualQuizIssue, 'code' | 'severity' | 'message'> = {},
): ManualQuizIssue => ({ code, severity, message, ...details });

export const questionIssue = (
    questionId: string,
    code: string,
    message: string,
    field?: string,
): ManualQuizIssue => createQuizIssue(code, 'error', message, {
    questionId,
    field,
    action: 'go-to-question',
});

export const normalizeAuthoringText = (value: unknown): string =>
    String(value ?? '').trim().replace(/\s+/g, ' ');

export const hasUnsafeMediaValue = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return normalized.startsWith('blob:') || normalized.startsWith('data:image/');
};
