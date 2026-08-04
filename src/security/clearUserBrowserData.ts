import { StorageKeys } from '../constants/storageKeys';

const safeRemove = (storage: Storage | undefined, key: string): void => {
    try { storage?.removeItem(key); } catch { /* restricted browser storage */ }
};

const clearPrefix = (storage: Storage | undefined, prefix: string): void => {
    if (!storage) return;
    try {
        const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
            .filter((key): key is string => Boolean(key?.startsWith(prefix)));
        keys.forEach(key => storage.removeItem(key));
    } catch { /* logout cleanup is best-effort */ }
};

export function clearUserBrowserData(): void {
    const local = typeof window === 'undefined' ? undefined : window.localStorage;
    const session = typeof window === 'undefined' ? undefined : window.sessionStorage;
    for (const key of [StorageKeys.STUDENT_SESSION, StorageKeys.STUDENT_SESSION_RESTORE_HINT, StorageKeys.GAMIFICATION, StorageKeys.GIFT_SHOP_MOCK_STATE]) {
        safeRemove(local, key);
        safeRemove(session, key);
    }
    clearPrefix(local, 'tohieuquiz_cache:');
    clearPrefix(session, 'tohieuquiz_cache:');
    clearPrefix(session, 'tohieuquiz_cache_session:');
    clearPrefix(session, 'tohieuquiz_quiz_attempt_v1:');
}
