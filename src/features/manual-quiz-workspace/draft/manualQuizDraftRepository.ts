import { hasMeaningfulManualQuizDraftContent } from '../../../../shared/manual-quiz-draft.contract';
import type { ManualQuizDraftEnvelope } from '../types/manualQuizWorkspace.types';
import {
    deserializeManualQuizDraft,
    serializeManualQuizDraft,
} from './manualQuizDraftSerializer';

const DRAFT_KEY_PREFIX = 'tohieuquiz:manual-draft:v1';
const INDEX_KEY_PREFIX = 'tohieuquiz:manual-draft:index:v1';

interface DraftIndexItem {
    draftId: string;
    quizId?: string;
    updatedAt: string;
}

export class ManualQuizDraftStorageError extends Error {
    readonly code: 'QUOTA' | 'UNAVAILABLE' | 'UNKNOWN';

    constructor(message: string, code: ManualQuizDraftStorageError['code']) {
        super(message);
        this.name = 'ManualQuizDraftStorageError';
        this.code = code;
    }
}

const getStorage = (): Storage => {
    if (typeof localStorage === 'undefined') {
        throw new ManualQuizDraftStorageError(
            'Trình duyệt hiện không cho phép lưu bản nháp trên thiết bị.',
            'UNAVAILABLE',
        );
    }
    return localStorage;
};

export const getManualQuizDraftKey = (ownerUsername: string, draftId: string): string =>
    `${DRAFT_KEY_PREFIX}:${ownerUsername}:${draftId}`;

const getIndexKey = (ownerUsername: string): string =>
    `${INDEX_KEY_PREFIX}:${ownerUsername}`;

const readIndex = (storage: Storage, ownerUsername: string): DraftIndexItem[] => {
    try {
        const raw = storage.getItem(getIndexKey(ownerUsername));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is DraftIndexItem => !!item
            && typeof item === 'object'
            && typeof (item as DraftIndexItem).draftId === 'string'
            && typeof (item as DraftIndexItem).updatedAt === 'string');
    } catch {
        return [];
    }
};

const writeIndex = (
    storage: Storage,
    ownerUsername: string,
    items: DraftIndexItem[],
): void => {
    storage.setItem(getIndexKey(ownerUsername), JSON.stringify(items));
};

const asStorageError = (error: unknown): ManualQuizDraftStorageError => {
    if (error instanceof ManualQuizDraftStorageError) return error;
    if (error instanceof DOMException && (
        error.name === 'QuotaExceededError'
        || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
        return new ManualQuizDraftStorageError(
            'Bộ nhớ trình duyệt đã đầy. Bản nháp vẫn còn trong màn hình hiện tại; hãy tải ảnh lên hoặc giải phóng dung lượng rồi thử lại.',
            'QUOTA',
        );
    }
    return new ManualQuizDraftStorageError(
        'Trình duyệt chưa thể lưu bản nháp trên thiết bị. Nội dung hiện tại vẫn được giữ trong màn hình.',
        'UNKNOWN',
    );
};

export interface SaveLocalDraftResult {
    hash: string;
    savedAt: string;
}

export const saveLocalDraft = (
    envelope: ManualQuizDraftEnvelope,
): SaveLocalDraftResult => {
    const storage = getStorage();
    const serialized = serializeManualQuizDraft(envelope);
    try {
        storage.setItem(
            getManualQuizDraftKey(envelope.ownerUsername, envelope.draftId),
            serialized.payload,
        );
        const currentIndex = readIndex(storage, envelope.ownerUsername)
            .filter((item) => item.draftId !== envelope.draftId);
        currentIndex.push({
            draftId: envelope.draftId,
            quizId: envelope.quizId,
            updatedAt: envelope.updatedAt,
        });
        currentIndex.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        writeIndex(storage, envelope.ownerUsername, currentIndex.slice(0, 20));
        return { hash: serialized.hash, savedAt: new Date().toISOString() };
    } catch (error) {
        throw asStorageError(error);
    }
};

export const loadLocalDraft = (
    ownerUsername: string,
    draftId: string,
): ManualQuizDraftEnvelope | null => {
    const storage = getStorage();
    const raw = storage.getItem(getManualQuizDraftKey(ownerUsername, draftId));
    return raw ? deserializeManualQuizDraft(raw) : null;
};

export const findLatestLocalDraft = (
    ownerUsername: string,
    quizId?: string,
): ManualQuizDraftEnvelope | null => {
    const storage = getStorage();
    const index = readIndex(storage, ownerUsername);
    for (const item of index) {
        if (quizId && item.quizId !== quizId) continue;
        const draft = loadLocalDraft(ownerUsername, item.draftId);
        if (draft && hasMeaningfulManualQuizDraftContent(draft)) return draft;
    }
    return null;
};

export const removeLocalDraft = (ownerUsername: string, draftId: string): void => {
    const storage = getStorage();
    try {
        storage.removeItem(getManualQuizDraftKey(ownerUsername, draftId));
        writeIndex(
            storage,
            ownerUsername,
            readIndex(storage, ownerUsername).filter((item) => item.draftId !== draftId),
        );
    } catch (error) {
        throw asStorageError(error);
    }
};
