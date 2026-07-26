/**
 * CacheService - Hybrid Caching with Memory Cache + LocalStorage
 * 
 * Features:
 * - In-memory cache for fast reads
 * - LocalStorage persistence for data survival across refreshes
 * - TTL-based expiration
 * - Stale-While-Revalidate pattern
 * - Cache invalidation by key or prefix
 */
import { logger } from './logger';
import { StorageKeys } from '../constants/storageKeys';

// Cache entry structure
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;  // Time-to-live in milliseconds
}

// Cache configuration
export const CacheTTL = {
    QUIZZES: 5 * 60 * 1000,      // 5 minutes
    TEACHERS: 30 * 60 * 1000,    // 30 minutes  
    RESULTS: 1 * 60 * 1000,      // 1 minute
    SHORT: 30 * 1000,            // 30 seconds
    NONE: 0,                     // No caching
} as const;

// Cache key builders
export const CacheKeys = {
    quizzes: (sheetId: string) => `quizzes:${sheetId}`,
    teachers: (sheetId: string) => `teachers:${sheetId}`,
    results: (sheetId: string) => `results:${sheetId}`,
    quiz: (quizId: string) => `quiz:${quizId}`,
};

// Storage prefix to avoid conflicts
const STORAGE_PREFIX = 'tohieuquiz_cache:';

class CacheService {
    private memoryCache: Map<string, CacheEntry<any>> = new Map();
    private isLocalStorageAvailable: boolean;

    constructor() {
        this.isLocalStorageAvailable = this.checkLocalStorageAvailability();
        this.loadFromLocalStorage();
        logger.debug('CacheService initialized', {
            module: 'Cache',
            localStorageAvailable: this.isLocalStorageAvailable
        });
    }

    /**
     * Check if localStorage is available
     */
    private checkLocalStorageAvailability(): boolean {
        try {
            const testKey = StorageKeys.CACHE_TEST;
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Load existing cache entries from localStorage on init
     */
    private loadFromLocalStorage(): void {
        if (!this.isLocalStorageAvailable) return;

        try {
            const keys = Object.keys(localStorage).filter(key =>
                key.startsWith(STORAGE_PREFIX)
            );

            for (const storageKey of keys) {
                const cacheKey = storageKey.replace(STORAGE_PREFIX, '');
                const rawData = localStorage.getItem(storageKey);

                if (rawData) {
                    const entry: CacheEntry<any> = JSON.parse(rawData);

                    // Only load non-expired entries
                    if (!this.isExpired(entry)) {
                        this.memoryCache.set(cacheKey, entry);
                    } else {
                        // Clean up expired entries
                        localStorage.removeItem(storageKey);
                    }
                }
            }

            logger.debug(`Loaded ${this.memoryCache.size} cache entries from localStorage`, {
                module: 'Cache'
            });
        } catch (error) {
            logger.error('Failed to load cache from localStorage', { module: 'Cache', error });
        }
    }

    /**
     * Check if cache entry is expired
     */
    private isExpired(entry: CacheEntry<any>): boolean {
        if (entry.ttl === 0) return true;  // No caching
        return Date.now() - entry.timestamp > entry.ttl;
    }

    /**
     * Get item from cache (memory first, then localStorage)
     */
    get<T>(key: string): T | null {
        // Check memory cache first
        const entry = this.memoryCache.get(key);

        if (entry) {
            if (this.isExpired(entry)) {
                this.invalidate(key);
                logger.debug(`Cache expired: ${key}`, { module: 'Cache' });
                return null;
            }
            logger.debug(`Cache hit (memory): ${key}`, { module: 'Cache' });
            return entry.data as T;
        }

        logger.debug(`Cache miss: ${key}`, { module: 'Cache' });
        return null;
    }

    /**
     * Set item in cache (both memory and localStorage)
     */
    set<T>(key: string, data: T, ttlMs: number = CacheTTL.QUIZZES): void {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        };

        // Set in memory cache
        this.memoryCache.set(key, entry);

        // Persist to localStorage
        if (this.isLocalStorageAvailable && ttlMs > 0) {
            try {
                localStorage.setItem(
                    STORAGE_PREFIX + key,
                    JSON.stringify(entry)
                );
            } catch (error) {
                // localStorage might be full, log and continue
                logger.warn(`Failed to persist cache to localStorage: ${key}`, {
                    module: 'Cache',
                    error
                });
            }
        }

        logger.debug(`Cache set: ${key} (TTL: ${ttlMs}ms)`, { module: 'Cache' });
    }

    /**
     * Get cached data or fetch if not available (Stale-While-Revalidate)
     */
    async getOrFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttlMs: number = CacheTTL.QUIZZES,
        options: { forceRefresh?: boolean; staleWhileRevalidate?: boolean } = {}
    ): Promise<T> {
        const { forceRefresh = false, staleWhileRevalidate = true } = options;

        // If force refresh, skip cache
        if (!forceRefresh) {
            const cached = this.get<T>(key);
            if (cached !== null) {
                return cached;
            }
        }

        // Check for stale data while we fetch fresh data
        const staleEntry = this.memoryCache.get(key);

        // Fetch fresh data
        try {
            logger.debug(`Fetching fresh data: ${key}`, { module: 'Cache' });
            const freshData = await fetcher();
            this.set(key, freshData, ttlMs);
            return freshData;
        } catch (error) {
            // If fetch fails and we have stale data, return it
            if (staleWhileRevalidate && staleEntry) {
                logger.warn(`Fetch failed, returning stale data: ${key}`, {
                    module: 'Cache',
                    error
                });
                return staleEntry.data as T;
            }
            throw error;
        }
    }

    /**
     * Invalidate specific cache key
     */
    invalidate(key: string): void {
        this.memoryCache.delete(key);

        if (this.isLocalStorageAvailable) {
            localStorage.removeItem(STORAGE_PREFIX + key);
        }

        logger.debug(`Cache invalidated: ${key}`, { module: 'Cache' });
    }

    /**
     * Invalidate all cache keys with given prefix
     */
    invalidatePrefix(prefix: string): void {
        // Memory cache
        for (const key of this.memoryCache.keys()) {
            if (key.startsWith(prefix)) {
                this.memoryCache.delete(key);
            }
        }

        // LocalStorage
        if (this.isLocalStorageAvailable) {
            const storagePrefix = STORAGE_PREFIX + prefix;
            const keysToRemove = Object.keys(localStorage).filter(key =>
                key.startsWith(storagePrefix)
            );
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }

        logger.debug(`Cache invalidated with prefix: ${prefix}`, { module: 'Cache' });
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.memoryCache.clear();

        if (this.isLocalStorageAvailable) {
            const keysToRemove = Object.keys(localStorage).filter(key =>
                key.startsWith(STORAGE_PREFIX)
            );
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }

        logger.info('Cache cleared', { module: 'Cache' });
    }

    /**
     * Get cache statistics
     */
    getStats(): { memorySize: number; keys: string[] } {
        return {
            memorySize: this.memoryCache.size,
            keys: Array.from(this.memoryCache.keys()),
        };
    }
}

// Singleton instance
export const cacheService = new CacheService();

// Export class for testing
export { CacheService };
