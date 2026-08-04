// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { clearUserBrowserData } from '../src/security/clearUserBrowserData';
import { StorageKeys } from '../src/constants/storageKeys';

describe('clearUserBrowserData', () => {
    it('removes user-scoped and legacy cache data without deleting safe preferences', () => {
        localStorage.setItem(StorageKeys.STUDENT_SESSION, '{"fullName":"Lan"}');
        localStorage.setItem(StorageKeys.GAMIFICATION, '{"coins":20}');
        localStorage.setItem('tohieuquiz_cache:results:1', '{"score":10}');
        localStorage.setItem(StorageKeys.AI_PROVIDER, 'gateway');
        sessionStorage.setItem('tohieuquiz_cache_session:user:quiz:1', '{}');
        sessionStorage.setItem('tohieuquiz_quiz_attempt_v1:quiz-1', '{"answers":{"q1":"A"}}');
        clearUserBrowserData();
        expect(localStorage.getItem(StorageKeys.STUDENT_SESSION)).toBeNull();
        expect(localStorage.getItem(StorageKeys.GAMIFICATION)).toBeNull();
        expect(localStorage.getItem('tohieuquiz_cache:results:1')).toBeNull();
        expect(sessionStorage.length).toBe(0);
        expect(localStorage.getItem(StorageKeys.AI_PROVIDER)).toBe('gateway');
    });
});
