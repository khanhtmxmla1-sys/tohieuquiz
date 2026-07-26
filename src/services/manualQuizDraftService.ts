import type {
    ManualQuizDraftConflictPayload,
    ManualQuizDraftRecord,
    PutManualQuizDraftRequest,
} from '../../shared/manual-quiz-draft.contract';
import type { ManualQuizDraftEnvelope } from '../features/manual-quiz-workspace/types/manualQuizWorkspace.types';
import { getWorkersApiBaseUrl } from './api/config';
import { ApiError, normalizeNetworkError, toApiError } from './api/errors';

const draftUrl = (draftId: string): string =>
    `${getWorkersApiBaseUrl()}/api/quiz-drafts/${encodeURIComponent(draftId)}`;

export class ManualQuizDraftConflictError extends Error {
    readonly current: ManualQuizDraftRecord | null;

    constructor(message: string, current: ManualQuizDraftRecord | null) {
        super(message);
        this.name = 'ManualQuizDraftConflictError';
        this.current = current;
    }
}

const requestDraft = async <T>(
    draftId: string,
    init: RequestInit,
): Promise<T> => {
    try {
        const response = await fetch(draftUrl(draftId), {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...init,
        });

        if (response.status === 409) {
            const conflict = await response.json().catch(() => null) as ManualQuizDraftConflictPayload | null;
            if (conflict?.code === 'DRAFT_CONFLICT') {
                throw new ManualQuizDraftConflictError(
                    conflict.message || 'Bản nháp đã được cập nhật ở nơi khác.',
                    conflict.current ?? null,
                );
            }
        }

        if (!response.ok) throw await toApiError(response);
        return await response.json() as T;
    } catch (error) {
        if (error instanceof ManualQuizDraftConflictError) throw error;
        throw normalizeNetworkError(error);
    }
};

export const getRemoteManualQuizDraft = (
    draftId: string,
    signal?: AbortSignal,
): Promise<ManualQuizDraftRecord> => requestDraft<ManualQuizDraftRecord>(draftId, {
    method: 'GET',
    signal,
});

export const putRemoteManualQuizDraft = (
    envelope: ManualQuizDraftEnvelope,
    expectedRevision: number,
    signal?: AbortSignal,
): Promise<ManualQuizDraftRecord> => {
    const request: PutManualQuizDraftRequest = {
        expectedRevision,
        draft: envelope,
    };
    return requestDraft<ManualQuizDraftRecord>(envelope.draftId, {
        method: 'PUT',
        body: JSON.stringify(request),
        signal,
    });
};

export const deleteRemoteManualQuizDraft = async (
    draftId: string,
    signal?: AbortSignal,
): Promise<void> => {
    await requestDraft<{ status: 'success'; id: string }>(draftId, {
        method: 'DELETE',
        signal,
    });
};

export const deleteRemoteManualQuizDraftIfExists = async (
    draftId: string,
    signal?: AbortSignal,
): Promise<void> => {
    try {
        await deleteRemoteManualQuizDraft(draftId, signal);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return;
        throw error;
    }
};
