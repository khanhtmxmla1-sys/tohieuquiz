import { StorageKeys, type StorageKeyValue } from '../constants/storageKeys';

export type DataClassification = 'public' | 'display' | 'personal' | 'sensitive' | 'credential';
export type BrowserPersistence = 'memory' | 'session' | 'local-safe' | 'forbidden';

export interface StoragePolicyEntry {
    keyPattern: RegExp;
    classification: DataClassification;
    persistence: BrowserPersistence;
    clearOnLogout: boolean;
    maximumTtlMs?: number;
    rationale: string;
}

const MINUTE = 60_000;

export const storagePolicy: readonly StoragePolicyEntry[] = [
    { keyPattern: /^tohieuquiz_student_session$/, classification: 'personal', persistence: 'forbidden', clearOnLogout: true, rationale: 'Legacy complete student profile; cleanup-only.' },
    { keyPattern: /^tohieuquiz_student_restore_hint$/, classification: 'display', persistence: 'local-safe', clearOnLogout: true, maximumTtlMs: 7 * 24 * 60 * MINUTE, rationale: 'Non-identifying boolean used to validate the HttpOnly cookie.' },
    { keyPattern: /^tohieuquiz_gamification$/, classification: 'personal', persistence: 'forbidden', clearOnLogout: true, rationale: 'Coins, pets and inventory are server-authoritative.' },
    { keyPattern: /^(ai_provider|gen_ai_provider)$/, classification: 'display', persistence: 'local-safe', clearOnLogout: false, rationale: 'Non-secret UI preference only.' },
    { keyPattern: /^__cache_test__$/, classification: 'public', persistence: 'session', clearOnLogout: true, maximumTtlMs: MINUTE, rationale: 'Ephemeral capability probe.' },
    { keyPattern: /^tohieuquiz_gift_shop_mock_state$/, classification: 'personal', persistence: 'forbidden', clearOnLogout: true, rationale: 'Mock balances and orders must not persist.' },
    { keyPattern: /^(token|jwt|password|authorization|refresh_token)$/i, classification: 'credential', persistence: 'forbidden', clearOnLogout: true, rationale: 'Credentials belong in secure cookies or server secret storage.' },
    { keyPattern: /^tohieuquiz_cache:/, classification: 'personal', persistence: 'forbidden', clearOnLogout: true, rationale: 'Legacy persistent cache may contain personal data.' },
] as const;

export function classifyStorageKey(key: string): StoragePolicyEntry {
    const entry = storagePolicy.find(candidate => candidate.keyPattern.test(key));
    if (!entry) throw new Error(`Storage key is not classified: ${key}`);
    return entry;
}

export const classifiedStorageKeys: readonly StorageKeyValue[] = Object.values(StorageKeys);

export function canPersistStorageKey(key: string, persistence: Exclude<BrowserPersistence, 'memory' | 'forbidden'>): boolean {
    return classifyStorageKey(key).persistence === persistence;
}
