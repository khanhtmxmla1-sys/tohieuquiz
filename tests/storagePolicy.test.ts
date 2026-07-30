import { describe, expect, it } from 'vitest';
import { StorageKeys } from '../src/constants/storageKeys';
import { classifyStorageKey } from '../src/security/storagePolicy';

describe('browser storage policy', () => {
    it('classifies every centralized storage key', () => {
        for (const key of Object.values(StorageKeys)) expect(() => classifyStorageKey(key)).not.toThrow();
    });

    it('forbids credentials and complete student profiles', () => {
        expect(classifyStorageKey('jwt')).toMatchObject({ classification: 'credential', persistence: 'forbidden' });
        expect(classifyStorageKey(StorageKeys.STUDENT_SESSION)).toMatchObject({
            classification: 'personal', persistence: 'forbidden', clearOnLogout: true,
        });
    });

    it('allows only non-identifying restore hints to persist locally', () => {
        for (const key of [StorageKeys.STUDENT_SESSION_RESTORE_HINT, StorageKeys.TEACHER_SESSION_RESTORE_HINT]) {
            expect(classifyStorageKey(key)).toMatchObject({
                classification: 'display', persistence: 'local-safe', clearOnLogout: true,
            });
        }
    });
});
