import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ManualQuizDraftEnvelope } from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';
import {
    deleteRemoteManualQuizDraft,
    deleteRemoteManualQuizDraftIfExists,
    getRemoteManualQuizDraft,
    ManualQuizDraftConflictError,
    putRemoteManualQuizDraft,
} from '../src/services/manualQuizDraftService';

const envelope: ManualQuizDraftEnvelope = {
    schemaVersion: 1,
    draftId: 'draft-1',
    ownerUsername: 'teacher-a',
    revision: 1,
    quiz: {
        id: 'quiz-manual-1', title: 'Đề Toán', classLevel: '3A',
        category: 'toan', timeLimit: 15, questions: [], createdAt: '2026-07-21T08:00:00.000Z',
    },
    selectedQuestionId: null,
    targetPoints: 10,
    updatedAt: '2026-07-21T08:00:00.000Z',
};

const record = {
    id: 'draft-1', ownerUsername: 'teacher-a', revision: 2,
    draft: { ...envelope, revision: 2 },
    createdAt: '2026-07-21T08:00:00.000Z',
    updatedAt: '2026-07-21T09:00:00.000Z',
};

afterEach(() => vi.restoreAllMocks());

describe('manualQuizDraftService', () => {
    it('puts the draft with cookie auth and expected revision', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(record), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        }));

        const result = await putRemoteManualQuizDraft(envelope, 1);

        expect(result.revision).toBe(2);
        expect(fetchMock).toHaveBeenCalledWith('/api/quiz-drafts/draft-1', expect.objectContaining({
            method: 'PUT', credentials: 'include',
            headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }));
        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(JSON.parse(String(init.body))).toMatchObject({ expectedRevision: 1, draft: envelope });
    });

    it('loads and deletes a draft using encoded ids and abort signals', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(record), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', id: 'draft/1' }), { status: 200 }));
        const controller = new AbortController();

        expect((await getRemoteManualQuizDraft('draft/1', controller.signal)).id).toBe('draft-1');
        await deleteRemoteManualQuizDraft('draft/1', controller.signal);

        expect(fetchMock.mock.calls[0][0]).toBe('/api/quiz-drafts/draft%2F1');
        expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ signal: controller.signal }));
        expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'DELETE' }));
    });

    it('treats a missing remote draft as already cleaned up', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
            status: 'error', message: 'Không tìm thấy bản nháp.',
        }), { status: 404, headers: { 'Content-Type': 'application/json' } }));

        await expect(deleteRemoteManualQuizDraftIfExists('draft-1')).resolves.toBeUndefined();
    });

    it('throws a typed conflict carrying the current server draft', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
            status: 'error', code: 'DRAFT_CONFLICT', message: 'conflict', current: record,
        }), { status: 409, headers: { 'Content-Type': 'application/json' } }));

        const error = await putRemoteManualQuizDraft(envelope, 1).catch((caught) => caught);

        expect(error).toBeInstanceOf(ManualQuizDraftConflictError);
        expect(error.current.revision).toBe(2);
    });
});
