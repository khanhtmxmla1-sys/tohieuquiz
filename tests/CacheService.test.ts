/**
 * CacheService Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheService, CacheTTL, CacheKeys } from '../src/services/CacheService';

describe('CacheService', () => {
    let cacheService: CacheService;

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        // Create fresh instance
        cacheService = new CacheService();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Memory Cache', () => {
        it('should return null for non-existent key', () => {
            const result = cacheService.get('non-existent');
            expect(result).toBeNull();
        });

        it('should set and get value from cache', () => {
            const testData = { name: 'test', value: 123 };
            cacheService.set('test-key', testData, CacheTTL.QUIZZES);

            const result = cacheService.get('test-key');
            expect(result).toEqual(testData);
        });

        it('should return null for expired cache entry', async () => {
            const testData = { name: 'test' };
            cacheService.set('expired-key', testData, 50); // 50ms TTL

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 100));

            const result = cacheService.get('expired-key');
            expect(result).toBeNull();
        });
    });

    describe('Cache Invalidation', () => {
        it('should invalidate specific key', () => {
            cacheService.set('key1', 'value1', CacheTTL.QUIZZES);
            cacheService.set('key2', 'value2', CacheTTL.QUIZZES);

            cacheService.invalidate('key1');

            expect(cacheService.get('key1')).toBeNull();
            expect(cacheService.get('key2')).toBe('value2');
        });

        it('should invalidate keys with prefix', () => {
            cacheService.set('quizzes:sheet1', ['quiz1'], CacheTTL.QUIZZES);
            cacheService.set('quizzes:sheet2', ['quiz2'], CacheTTL.QUIZZES);
            cacheService.set('teachers:sheet1', ['teacher1'], CacheTTL.TEACHERS);

            cacheService.invalidatePrefix('quizzes:');

            expect(cacheService.get('quizzes:sheet1')).toBeNull();
            expect(cacheService.get('quizzes:sheet2')).toBeNull();
            expect(cacheService.get('teachers:sheet1')).toEqual(['teacher1']);
        });

        it('should clear all cache', () => {
            cacheService.set('key1', 'value1', CacheTTL.QUIZZES);
            cacheService.set('key2', 'value2', CacheTTL.TEACHERS);

            cacheService.clear();

            expect(cacheService.get('key1')).toBeNull();
            expect(cacheService.get('key2')).toBeNull();
        });
    });

    describe('getOrFetch', () => {
        it('should return cached data without calling fetcher', async () => {
            const mockFetcher = vi.fn().mockResolvedValue(['fresh data']);
            cacheService.set('cached-key', ['cached data'], CacheTTL.QUIZZES);

            const result = await cacheService.getOrFetch('cached-key', mockFetcher, CacheTTL.QUIZZES);

            expect(result).toEqual(['cached data']);
            expect(mockFetcher).not.toHaveBeenCalled();
        });

        it('should call fetcher when cache is empty', async () => {
            const mockFetcher = vi.fn().mockResolvedValue(['fresh data']);

            const result = await cacheService.getOrFetch('new-key', mockFetcher, CacheTTL.QUIZZES);

            expect(result).toEqual(['fresh data']);
            expect(mockFetcher).toHaveBeenCalledOnce();
        });

        it('should force refresh when option is set', async () => {
            const mockFetcher = vi.fn().mockResolvedValue(['fresh data']);
            cacheService.set('cached-key', ['cached data'], CacheTTL.QUIZZES);

            const result = await cacheService.getOrFetch(
                'cached-key',
                mockFetcher,
                CacheTTL.QUIZZES,
                { forceRefresh: true }
            );

            expect(result).toEqual(['fresh data']);
            expect(mockFetcher).toHaveBeenCalledOnce();
        });

        it('should return stale data when force refresh fails', async () => {
            // First, set valid cached data
            cacheService.set('stale-key', ['cached data'], CacheTTL.QUIZZES);

            // Mock fetcher that fails
            const mockFetcher = vi.fn().mockRejectedValue(new Error('Network error'));

            // Force refresh with failing fetcher - should return stale data
            const result = await cacheService.getOrFetch(
                'stale-key',
                mockFetcher,
                CacheTTL.QUIZZES,
                { forceRefresh: true }
            );

            expect(result).toEqual(['cached data']);
            expect(mockFetcher).toHaveBeenCalledOnce();
        });
    });

    describe('CacheKeys', () => {
        it('should generate correct cache keys', () => {
            expect(CacheKeys.quizzes('sheet123')).toBe('quizzes:sheet123');
            expect(CacheKeys.teachers('sheet123')).toBe('teachers:sheet123');
            expect(CacheKeys.results('sheet123')).toBe('results:sheet123');
            expect(CacheKeys.quiz('quiz456')).toBe('quiz:quiz456');
        });
    });

    describe('CacheTTL', () => {
        it('should have correct TTL values', () => {
            expect(CacheTTL.QUIZZES).toBe(5 * 60 * 1000);     // 5 min
            expect(CacheTTL.TEACHERS).toBe(30 * 60 * 1000);   // 30 min
            expect(CacheTTL.RESULTS).toBe(1 * 60 * 1000);     // 1 min
            expect(CacheTTL.SHORT).toBe(30 * 1000);           // 30 sec
            expect(CacheTTL.NONE).toBe(0);
        });
    });

    describe('Cache Stats', () => {
        it('should return correct stats', () => {
            cacheService.set('key1', 'value1', CacheTTL.QUIZZES);
            cacheService.set('key2', 'value2', CacheTTL.QUIZZES);

            const stats = cacheService.getStats();

            expect(stats.memorySize).toBe(2);
            expect(stats.keys).toContain('key1');
            expect(stats.keys).toContain('key2');
        });
    });
});
