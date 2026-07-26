import type { AuthPolicy } from './types';

const LEGACY_DIRECT_TOKEN_KEYS = [
    'tohieuquiz_jwt_token',
    'tohieuquiz_teacher_jwt_token',
    'token',
    'jwt',
    'access_token',
] as const;

export function cleanupLegacyAuthStorage(): void {
    try {
        LEGACY_DIRECT_TOKEN_KEYS.forEach(key => localStorage.removeItem(key));

        const raw = localStorage.getItem('auth-storage');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed?.state && typeof parsed.state === 'object' && 'token' in parsed.state) {
                    delete parsed.state.token;
                    localStorage.setItem('auth-storage', JSON.stringify(parsed));
                }
            } catch {
                localStorage.removeItem('auth-storage');
            }
        }
    } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
    }
}

export function getJWTPurpose(token: string | null | undefined): 'session' | 'password_change' | null {
    if (!token) return null;
    try {
        const segment = token.split('.')[1];
        if (!segment) return null;
        const padded = segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - segment.length % 4) % 4);
        const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0));
        const payload = JSON.parse(new TextDecoder().decode(bytes));
        return payload?.purpose === 'password_change' ? 'password_change' : payload?.purpose === 'session' ? 'session' : null;
    } catch {
        return null;
    }
}

export function buildAuthHeaders(
    _policy: AuthPolicy,
    _path: string,
): Record<string, string> {
    // Browser sessions are transported exclusively by the HttpOnly cookie.
    // One-time migration tokens are injected explicitly by apiClient and never persisted.
    return {};
}
