// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CacheService, CacheTTL } from '../src/services/CacheService';

describe('CacheService storage policy', () => {
    beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

    it('uses memory by default and never writes localStorage', () => {
        const cache = new CacheService('student-1');
        cache.set('results:student-1', { score: 10 }, CacheTTL.RESULTS);
        expect(localStorage.length).toBe(0);
        expect(sessionStorage.length).toBe(0);
    });

    it('allows bounded session persistence for public quiz data', () => {
        const cache = new CacheService('anonymous');
        cache.set('quiz:public-1', { title: 'Public quiz' }, CacheTTL.QUIZZES, { persistence: 'session' });
        expect(sessionStorage.length).toBe(1);
        expect(new CacheService('anonymous').get('quiz:public-1')).toEqual({ title: 'Public quiz' });
    });

    it('rejects session persistence for personal collections', () => {
        const cache = new CacheService('teacher-1');
        expect(() => cache.set('students:class-1', [], CacheTTL.SHORT, { persistence: 'session' }))
            .toThrow('Session persistence is forbidden');
    });

    it('isolates persisted values by namespace', () => {
        const first = new CacheService('account-a');
        first.set('quiz:public-1', { owner: 'a' }, CacheTTL.QUIZZES, { persistence: 'session' });
        expect(new CacheService('account-b').get('quiz:public-1')).toBeNull();
    });
});
