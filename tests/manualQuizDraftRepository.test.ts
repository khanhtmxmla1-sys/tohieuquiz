import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import {
    deserializeManualQuizDraft,
    ManualQuizDraftSerializationError,
    serializeManualQuizDraft,
} from '../src/features/manual-quiz-workspace/draft/manualQuizDraftSerializer';
import {
    findLatestLocalDraft,
    loadLocalDraft,
    ManualQuizDraftStorageError,
    removeLocalDraft,
    saveLocalDraft,
} from '../src/features/manual-quiz-workspace/draft/manualQuizDraftRepository';
import type { ManualQuizDraftEnvelope } from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';

const makeEnvelope = (overrides: Partial<ManualQuizDraftEnvelope> = {}): ManualQuizDraftEnvelope => ({
    schemaVersion: 1,
    draftId: 'draft-1',
    ownerUsername: 'teacher-a',
    revision: 0,
    quiz: {
        id: 'quiz-manual-1',
        title: 'Đề Toán',
        classLevel: '3A',
        category: 'toan',
        timeLimit: 15,
        questions: [{
            id: 'q-1',
            type: QuestionType.MCQ,
            question: '1 + 1 = ?',
            options: ['1', '2'],
            correctAnswer: 'B',
            difficulty: 1,
            points: 1,
        }],
        createdAt: '2026-07-21T08:00:00.000Z',
    },
    selectedQuestionId: 'q-1',
    targetPoints: 10,
    updatedAt: '2026-07-21T08:01:00.000Z',
    ...overrides,
});

describe('manual quiz local draft repository', () => {
    beforeEach(() => localStorage.clear());

    it('round-trips schema v1 with a stable content hash', () => {
        const envelope = makeEnvelope();
        const first = serializeManualQuizDraft(envelope);
        const second = serializeManualQuizDraft(envelope);

        expect(first.hash).toBe(second.hash);
        expect(deserializeManualQuizDraft(first.payload)).toEqual(envelope);
    });

    it('rejects non-persistable files, blob URLs and oversized base64 images', () => {
        const withFile = makeEnvelope();
        (withFile.quiz.questions[0] as any).attachment = new File(['data'], 'question.png');
        expect(() => serializeManualQuizDraft(withFile)).toThrow(ManualQuizDraftSerializationError);

        const withBlobUrl = makeEnvelope();
        (withBlobUrl.quiz.questions[0] as any).image = 'blob:https://example.com/temporary';
        expect(() => serializeManualQuizDraft(withBlobUrl)).toThrow(/blob URL/i);

        const withLargeImage = makeEnvelope();
        (withLargeImage.quiz.questions[0] as any).image = `data:image/png;base64,${'a'.repeat(300_000)}`;
        expect(() => serializeManualQuizDraft(withLargeImage)).toThrow(/quá lớn/i);
    });

    it('saves, loads, indexes latest and removes drafts per teacher', () => {
        const oldDraft = makeEnvelope({ draftId: 'old', updatedAt: '2026-07-21T08:00:00.000Z' });
        const newDraft = makeEnvelope({ draftId: 'new', updatedAt: '2026-07-21T09:00:00.000Z' });
        saveLocalDraft(oldDraft);
        saveLocalDraft(newDraft);

        expect(loadLocalDraft('teacher-a', 'old')).toEqual(oldDraft);
        expect(findLatestLocalDraft('teacher-a')?.draftId).toBe('new');
        removeLocalDraft('teacher-a', 'new');
        expect(loadLocalDraft('teacher-a', 'new')).toBeNull();
        expect(findLatestLocalDraft('teacher-a')?.draftId).toBe('old');
    });

    it('converts storage quota errors into a friendly typed error', () => {
        const original = Storage.prototype.setItem;
        const quota = new DOMException('Quota exceeded', 'QuotaExceededError');
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quota; });

        expect(() => saveLocalDraft(makeEnvelope())).toThrow(ManualQuizDraftStorageError);
        expect(() => saveLocalDraft(makeEnvelope())).toThrow(/trình duyệt/i);
        Storage.prototype.setItem = original;
    });
});
