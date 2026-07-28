/**
 * Privacy-aware cache: memory by default, optional session persistence for public quiz data.
 */
import { logger } from './logger';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

export type CachePersistence = 'memory' | 'session';
export interface CacheWriteOptions { persistence?: CachePersistence }

export const CacheTTL = {
    QUIZZES: 5 * 60 * 1000,
    TEACHERS: 30 * 60 * 1000,
    RESULTS: 1 * 60 * 1000,
    SHORT: 30 * 1000,
    NONE: 0,
} as const;

export const CacheKeys = {
    quizzes: (sheetId: string) => `quizzes:${sheetId}`,
    teachers: (sheetId: string) => `teachers:${sheetId}`,
    results: (sheetId: string) => `results:${sheetId}`,
    quiz: (quizId: string) => `quiz:${quizId}`,
};

const SESSION_PREFIX = 'tohieuquiz_cache_session:';
const LEGACY_LOCAL_PREFIX = 'tohieuquiz_cache:';
const SESSION_ALLOWED = /^(quizzes|quiz):/;
const MEMORY_ONLY = /^(teachers|results|students|student|parents|parent|orders|notifications):/;

const getSessionStorage = (): Storage | null => {
    if (typeof window === 'undefined') return null;
    try {
        window.sessionStorage.setItem('__cache_test__', '1');
        window.sessionStorage.removeItem('__cache_test__');
        return window.sessionStorage;
    } catch {
        return null;
    }
};

export class CacheService {
    private readonly memoryCache = new Map<string, CacheEntry<unknown>>();
    private namespace: string;
    private readonly sessionStorage: Storage | null;

    constructor(namespace = 'anonymous') {
        this.namespace = namespace;
        this.sessionStorage = getSessionStorage();
        this.removeLegacyLocalCache();
        this.loadSessionEntries();
    }

    private storagePrefix(): string { return `${SESSION_PREFIX}${this.namespace}:`; }
    private isExpired(entry: CacheEntry<unknown>): boolean {
        return entry.ttl === 0 || Date.now() - entry.timestamp > entry.ttl;
    }

    private removeLegacyLocalCache(): void {
        if (typeof window === 'undefined') return;
        try {
            Object.keys(window.localStorage)
                .filter(key => key.startsWith(LEGACY_LOCAL_PREFIX))
                .forEach(key => window.localStorage.removeItem(key));
        } catch {
            // Memory caching remains available.
        }
    }

    private loadSessionEntries(): void {
        if (!this.sessionStorage) return;
        const prefix = this.storagePrefix();
        try {
            Object.keys(this.sessionStorage)
                .filter(key => key.startsWith(prefix))
                .forEach(storageKey => {
                    const cacheKey = storageKey.slice(prefix.length);
                    const raw = this.sessionStorage?.getItem(storageKey);
                    if (!raw) return;
                    const entry = JSON.parse(raw) as CacheEntry<unknown>;
                    if (this.isExpired(entry) || !SESSION_ALLOWED.test(cacheKey)) {
                        this.sessionStorage?.removeItem(storageKey);
                        return;
                    }
                    this.memoryCache.set(cacheKey, entry);
                });
        } catch (error) {
            logger.warn('Failed to hydrate session cache', { module: 'Cache', error });
        }
    }

    setNamespace(namespace: string): void {
        if (namespace === this.namespace) return;
        this.clear();
        this.namespace = namespace || 'anonymous';
        this.loadSessionEntries();
    }

    get<T>(key: string): T | null {
        const entry = this.memoryCache.get(key);
        if (!entry) return null;
        if (this.isExpired(entry)) {
            this.invalidate(key);
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMs = CacheTTL.QUIZZES, options: CacheWriteOptions = {}): void {
        const persistence = options.persistence ?? 'memory';
        if (persistence === 'session' && (!SESSION_ALLOWED.test(key) || MEMORY_ONLY.test(key))) {
            throw new Error(`Session persistence is forbidden for cache key: ${key}`);
        }
        const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl: ttlMs };
        this.memoryCache.set(key, entry);
        if (persistence === 'session') {
            if (this.sessionStorage && ttlMs > 0) {
                this.sessionStorage.setItem(`${this.storagePrefix()}${key}`, JSON.stringify(entry));
            }
        }
    }

    async getOrFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttlMs = CacheTTL.QUIZZES,
        options: { forceRefresh?: boolean; staleWhileRevalidate?: boolean; persistence?: CachePersistence } = {},
    ): Promise<T> {
        const { forceRefresh = false, staleWhileRevalidate = true, persistence = 'memory' } = options;
        if (!forceRefresh) {
            const cached = this.get<T>(key);
            if (cached !== null) return cached;
        }
        const staleEntry = this.memoryCache.get(key);
        try {
            const data = await fetcher();
            this.set(key, data, ttlMs, { persistence });
            return data;
        } catch (error) {
            if (staleWhileRevalidate && staleEntry) {
                logger.warn(`Fetch failed, returning stale data: ${key}`, { module: 'Cache', error });
                return staleEntry.data as T;
            }
            throw error;
        }
    }

    invalidate(key: string): void {
        this.memoryCache.delete(key);
        this.sessionStorage?.removeItem(`${this.storagePrefix()}${key}`);
    }

    invalidatePrefix(prefix: string): void {
        for (const key of [...this.memoryCache.keys()]) {
            if (key.startsWith(prefix)) this.memoryCache.delete(key);
        }
        if (!this.sessionStorage) return;
        const storagePrefix = `${this.storagePrefix()}${prefix}`;
        Object.keys(this.sessionStorage)
            .filter(key => key.startsWith(storagePrefix))
            .forEach(key => this.sessionStorage?.removeItem(key));
    }

    clear(): void {
        this.memoryCache.clear();
        if (!this.sessionStorage) return;
        const prefix = this.storagePrefix();
        Object.keys(this.sessionStorage)
            .filter(key => key.startsWith(prefix))
            .forEach(key => this.sessionStorage?.removeItem(key));
    }

    getStats(): { memorySize: number; keys: string[]; namespace: string } {
        return { memorySize: this.memoryCache.size, keys: [...this.memoryCache.keys()], namespace: this.namespace };
    }
}

export const cacheService = new CacheService();
