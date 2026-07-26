import type { ManualQuizDraftEnvelope } from '../types/manualQuizWorkspace.types';

const MAX_EMBEDDED_IMAGE_DATA_URL_CHARS = 256_000;

export class ManualQuizDraftSerializationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ManualQuizDraftSerializationError';
    }
}

const isFileLike = (value: unknown): boolean => {
    if (typeof File !== 'undefined' && value instanceof File) return true;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
    return false;
};

const validatePersistableValue = (value: unknown, path = 'draft'): void => {
    if (isFileLike(value)) {
        throw new ManualQuizDraftSerializationError(
            `Không thể tự động lưu tệp chưa tải lên tại ${path}.`,
        );
    }
    if (typeof value === 'string') {
        if (value.startsWith('blob:')) {
            throw new ManualQuizDraftSerializationError(
                `Không thể tự động lưu blob URL tạm thời tại ${path}.`,
            );
        }
        if (value.startsWith('data:image/') && value.length > MAX_EMBEDDED_IMAGE_DATA_URL_CHARS) {
            throw new ManualQuizDraftSerializationError(
                `Ảnh nhúng tại ${path} quá lớn để lưu an toàn trong trình duyệt.`,
            );
        }
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => validatePersistableValue(item, `${path}[${index}]`));
        return;
    }
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            validatePersistableValue(child, `${path}.${key}`);
        }
    }
};

const hashText = (text: string): string => {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

const isDraftEnvelope = (value: unknown): value is ManualQuizDraftEnvelope => {
    if (!value || typeof value !== 'object') return false;
    const draft = value as Partial<ManualQuizDraftEnvelope>;
    return draft.schemaVersion === 1
        && typeof draft.draftId === 'string'
        && typeof draft.ownerUsername === 'string'
        && typeof draft.revision === 'number'
        && typeof draft.updatedAt === 'string'
        && typeof draft.targetPoints === 'number'
        && (draft.selectedQuestionId === null || typeof draft.selectedQuestionId === 'string')
        && !!draft.quiz
        && typeof draft.quiz === 'object'
        && typeof draft.quiz.id === 'string'
        && typeof draft.quiz.title === 'string'
        && Array.isArray(draft.quiz.questions);
};

export interface SerializedManualQuizDraft {
    payload: string;
    hash: string;
}

export const serializeManualQuizDraft = (
    envelope: ManualQuizDraftEnvelope,
): SerializedManualQuizDraft => {
    validatePersistableValue(envelope);
    const payload = JSON.stringify(envelope);
    return { payload, hash: hashText(payload) };
};

export const deserializeManualQuizDraft = (
    payload: string,
): ManualQuizDraftEnvelope | null => {
    try {
        const parsed = JSON.parse(payload) as unknown;
        if (!isDraftEnvelope(parsed)) return null;
        validatePersistableValue(parsed);
        return parsed;
    } catch (error) {
        if (error instanceof ManualQuizDraftSerializationError) throw error;
        return null;
    }
};

export const getManualQuizDraftHash = (envelope: ManualQuizDraftEnvelope): string =>
    serializeManualQuizDraft(envelope).hash;

export const getManualQuizDraftContentHash = (envelope: ManualQuizDraftEnvelope): string => {
    validatePersistableValue(envelope);
    return hashText(JSON.stringify({
        ...envelope,
        revision: 0,
        updatedAt: '',
    }));
};
