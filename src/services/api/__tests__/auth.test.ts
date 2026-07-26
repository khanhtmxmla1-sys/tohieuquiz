import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildAuthHeaders, cleanupLegacyAuthStorage, getJWTPurpose } from '../auth';

const mockStorage: Record<string, string> = {};

beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
        (key: string) => mockStorage[key] ?? null,
    );
});

describe('cookie-first auth headers', () => {
    it('does not read or send browser-persisted bearer tokens for session policies', () => {
        mockStorage['tohieuquiz_jwt_token'] = 'student-tok';
        mockStorage['tohieuquiz_teacher_jwt_token'] = 'teacher-tok';
        mockStorage['auth-storage'] = JSON.stringify({ state: { token: 'fallback-tok' } });

        expect(buildAuthHeaders('session', '/api/teachers')).toEqual({});
        expect(buildAuthHeaders('studentSession', '/api/game-loop/dashboard')).toEqual({});
        expect(buildAuthHeaders('public', '/api/health')).toEqual({});
    });
});

describe('legacy auth storage cleanup', () => {
    it('removes direct JWT keys and strips token fields while preserving harmless UI metadata', () => {
        const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
            delete mockStorage[key];
        });
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
            mockStorage[key] = value;
        });
        mockStorage['tohieuquiz_teacher_jwt_token'] = 'teacher-tok';
        mockStorage['tohieuquiz_jwt_token'] = 'student-tok';
        mockStorage['auth-storage'] = JSON.stringify({
            state: { username: 'teacher-a', teacherName: 'Cô An', token: 'fallback-tok' },
            version: 0,
        });

        cleanupLegacyAuthStorage();

        expect(removeItem).toHaveBeenCalledWith('tohieuquiz_teacher_jwt_token');
        expect(removeItem).toHaveBeenCalledWith('tohieuquiz_jwt_token');
        expect(JSON.parse(mockStorage['auth-storage'])).toEqual({
            state: { username: 'teacher-a', teacherName: 'Cô An' },
            version: 0,
        });
        expect(setItem).toHaveBeenCalled();
    });
});

describe('getJWTPurpose', () => {
    it('detects a password-change token without trusting storage state', () => {
        const payload = btoa(JSON.stringify({ purpose: 'password_change' }))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        expect(getJWTPurpose(`header.${payload}.signature`)).toBe('password_change');
        expect(getJWTPurpose('invalid-token')).toBeNull();
    });
});
