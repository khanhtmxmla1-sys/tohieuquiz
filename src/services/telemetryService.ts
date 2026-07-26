import { track } from '@vercel/analytics';

export type ManualQuizTelemetryEvent =
    | 'workspace_opened'
    | 'draft_save_succeeded'
    | 'draft_save_failed'
    | 'conflict_detected'
    | 'validation_failed'
    | 'publish_succeeded'
    | 'publish_failed';

export interface ManualQuizTelemetryInput {
    mode?: 'new' | 'edit';
    saveTarget?: 'local' | 'remote';
    outcome?: 'success' | 'failure' | 'blocked';
    durationMs?: number;
    questionCount?: number;
    issueCount?: number;
    online?: boolean;
    errorCode?: string;
    conflictKind?: 'revision' | 'missing_remote';
}

export type ManualQuizTelemetryPayload = Partial<Record<
    keyof ManualQuizTelemetryInput,
    string | number | boolean | undefined
>>;

const finiteNonNegativeInteger = (value: unknown): number | undefined => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return undefined;
    return Math.round(numeric);
};

export const normalizeManualQuizErrorCode = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const upper = value.toUpperCase();
    const httpStatus = upper.match(/HTTP\s*[_:-]?\s*(\d{3})/);
    if (httpStatus) return `HTTP_${httpStatus[1]}`;
    if (upper.includes('CONFLICT') || upper.includes('REVISION')) return 'REVISION_CONFLICT';
    if (upper.includes('OFFLINE')) return 'OFFLINE';
    if (upper.includes('NETWORK') || upper.includes('FETCH') || upper.includes('MẠNG')) return 'NETWORK_ERROR';
    if (upper.includes('VALIDATION') || upper.includes('INVALID')) return 'VALIDATION_ERROR';
    if (upper.includes('QUOTA') || upper.includes('STORAGE')) return 'LOCAL_STORAGE_ERROR';
    if (upper.includes('ABORT')) return 'REQUEST_ABORTED';
    return 'UNKNOWN_ERROR';
};

export const buildManualQuizTelemetryPayload = (
    input: ManualQuizTelemetryInput,
): ManualQuizTelemetryPayload => {
    const payload: ManualQuizTelemetryPayload = {};
    if (input.mode === 'new' || input.mode === 'edit') payload.mode = input.mode;
    if (input.saveTarget === 'local' || input.saveTarget === 'remote') payload.saveTarget = input.saveTarget;
    if (input.outcome === 'success' || input.outcome === 'failure' || input.outcome === 'blocked') {
        payload.outcome = input.outcome;
    }
    const durationMs = finiteNonNegativeInteger(input.durationMs);
    const questionCount = finiteNonNegativeInteger(input.questionCount);
    const issueCount = finiteNonNegativeInteger(input.issueCount);
    if (durationMs !== undefined) payload.durationMs = durationMs;
    if (questionCount !== undefined) payload.questionCount = questionCount;
    if (issueCount !== undefined) payload.issueCount = issueCount;
    if (typeof input.online === 'boolean') payload.online = input.online;
    const errorCode = normalizeManualQuizErrorCode(input.errorCode);
    if (errorCode) payload.errorCode = errorCode;
    if (input.conflictKind === 'revision' || input.conflictKind === 'missing_remote') {
        payload.conflictKind = input.conflictKind;
    }
    return payload;
};

export const reportManualQuizTelemetry = (
    event: ManualQuizTelemetryEvent,
    input: ManualQuizTelemetryInput = {},
): void => {
    try {
        track(`manual_quiz_${event}`, buildManualQuizTelemetryPayload(input));
    } catch {
        // Telemetry is best-effort and must never interrupt authoring.
    }
};
