import { describe, expect, it, vi } from 'vitest';
import { checkLoginLimit, clearLoginFailures, recordLoginFailure } from '../workers/src/utils/loginRateLimit';

class Statement {
    constructor(private readonly shouldThrow: boolean) {}
    bind() { return this; }
    async first<T>(): Promise<T | null> {
        if (this.shouldThrow) throw new Error('D1 unavailable');
        return null;
    }
    async run() {
        if (this.shouldThrow) throw new Error('D1 unavailable');
        return { success: true };
    }
}

const env = (shouldThrow: boolean) => ({
    DB: {
        prepare: vi.fn(() => new Statement(shouldThrow)),
        batch: vi.fn(async () => {
            if (shouldThrow) throw new Error('D1 unavailable');
            return [];
        }),
    },
} as any);

const request = new Request('https://api.thtohieu.com/api/login', {
    method: 'POST',
    headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'X-Forwarded-For': '9.9.9.9',
    },
});

describe('login rate-limit failure policy', () => {
    it('fails closed when the limiter cannot check counters', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const response = await checkLoginLimit(request, env(true), 'teacher-a');
        expect(response?.status).toBe(503);
        expect(response?.headers.get('Retry-After')).toBe('60');
        consoleSpy.mockRestore();
    });

    it('fails closed when a failed login cannot be recorded', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const response = await recordLoginFailure(request, env(true), 'teacher-a');
        expect(response?.status).toBe(503);
        consoleSpy.mockRestore();
    });

    it('fails closed when successful-login counters cannot be cleared', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const response = await clearLoginFailures(request, env(true), 'teacher-a');
        expect(response?.status).toBe(503);
        consoleSpy.mockRestore();
    });
});
