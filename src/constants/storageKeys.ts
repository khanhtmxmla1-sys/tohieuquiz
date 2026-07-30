/**
 * Storage Keys for LocalStorage / SessionStorage
 * Centralized place to prevent typos and key collisions.
 */
export const StorageKeys = {
    // Gamification & User State
    GAMIFICATION: 'tohieuquiz_gamification',
    STUDENT_SESSION: 'tohieuquiz_student_session',
    STUDENT_SESSION_RESTORE_HINT: 'tohieuquiz_student_restore_hint',
    TEACHER_SESSION_RESTORE_HINT: 'tohieuquiz_teacher_restore_hint',
    AI_PROVIDER: 'ai_provider',
    GEN_AI_PROVIDER: 'gen_ai_provider',

    // Testing & Caching
    CACHE_TEST: '__cache_test__',

    // Gift Shop
    GIFT_SHOP_MOCK_STATE: 'tohieuquiz_gift_shop_mock_state',
} as const;

export type StorageKeyName = keyof typeof StorageKeys;
export type StorageKeyValue = (typeof StorageKeys)[StorageKeyName];
