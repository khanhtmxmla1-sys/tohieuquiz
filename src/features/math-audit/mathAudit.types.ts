export interface MathAuditSyntaxIssue {
    field: string;
    code: string;
    message: string;
    index: number;
}

export interface MathAuditIssue {
    questionId: string;
    quizId: string;
    quizTitle: string;
    questionType: string;
    currentVersion: number;
    targetVersion: number;
    needsUpgrade: boolean;
    changedFields: string[];
    currentIssues: MathAuditSyntaxIssue[];
    remainingIssues: MathAuditSyntaxIssue[];
    previewBefore: string;
    previewAfter: string;
}

export interface MathAuditSummary {
    scanned: number;
    affected: number;
    autoFixable: number;
    blocked: number;
    currentVersion: number;
}


export interface MathRenderEvent {
    fingerprint: string;
    quiz_id: string;
    question_id: string;
    question_type: string;
    error_code: string;
    route: string;
    math_format_version: number;
    count: number;
    first_seen_at: string;
    last_seen_at: string;
}
