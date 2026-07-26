// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { handleTeacherRoutes } from '../workers/src/routes/teachers';
import { authenticateStudent } from '../workers/src/classroom/studentLoginService';
import { hashPasswordPbkdf2 } from '../workers/src/utils/password';
import { hashPassword } from '../workers/src/utils/response';
import { signJWT } from '../workers/src/utils/jwt';

vi.mock('../workers/src/utils/loginRateLimit', () => ({
    checkLoginLimit: vi.fn(async () => null),
    clearLoginFailures: vi.fn(async () => undefined),
    recordLoginFailure: vi.fn(async () => undefined),
}));
vi.mock('../workers/src/utils/audit', () => ({
    auditStatement: vi.fn(),
    writeAuditLog: vi.fn(async () => undefined),
}));

let teacherPassword = '';
let studentPassword = '';

beforeAll(async () => {
    teacherPassword = await hashPasswordPbkdf2('TeacherPass123');
    studentPassword = await hashPassword('StudentPass123');
});

const teacher = () => ({
    username: 'teacher-a',
    password: teacherPassword,
    full_name: 'Cô An',
    role: 'teacher',
    class: '3A',
    status: 'ACTIVE',
    must_change_password: 0,
    token_version: 2,
    password_changed_at: null,
    last_login_at: null,
    disabled_at: null,
    disabled_by: null,
    disabled_reason: null,
    created_at: null,
    updated_at: null,
});

class Statement {
    bindings: unknown[] = [];
    constructor(private readonly sql: string) {}
    bind(...values: unknown[]) { this.bindings = values; return this; }
    async first<T>() {
        if (this.sql.includes('FROM teachers')) return teacher() as T;
        if (this.sql.includes('FROM students s')) return {
            id: 'student-1', username: 'student-a', full_name: 'Học sinh An',
            password_hash: studentPassword, class_id: 'class-1', class_name: '3A',
            avatar: '', coins: 20, pet_id: null,
        } as T;
        return null as T;
    }
    async all<T>() {
        if (this.sql.includes('SELECT * FROM shop_items')) return { results: [] as T[] };
        return { results: [] as T[] };
    }
    async run() { return { success: true }; }
}

const env = (mode: 'compat' | 'cookie') => ({
    DB: {
        prepare: (sql: string) => new Statement(sql),
        batch: async () => [],
    },
    JWT_SECRET: 'a-test-secret-that-is-long-enough',
    AUTH_MIGRATION_MODE: 'enforce',
    AUTH_TOKEN_TRANSPORT_MODE: mode,
} as any);

const loginRequest = () => new Request('https://api.test/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'teacher-a', password: 'TeacherPass123' }),
});

describe('backend auth transport integration', () => {
    it('returns a rollback token only in compat mode', async () => {
        const compat = await handleTeacherRoutes(loginRequest(), env('compat'), '/api/login', 'POST');
        const cookie = await handleTeacherRoutes(loginRequest(), env('cookie'), '/api/login', 'POST');
        const compatBody = await compat.json() as any;
        const cookieBody = await cookie.json() as any;

        expect(compatBody.data.token).toEqual(expect.any(String));
        expect(cookieBody.data.token).toBeUndefined();
        expect(cookieBody.data).toMatchObject({ username: 'teacher-a', fullName: 'Cô An' });
        expect(cookie.headers.get('Set-Cookie')).toContain('SameSite=Lax');
        expect(cookie.headers.get('Cache-Control')).toBe('no-store');
    });

    it('changes a password with the cookie-mode response omitting the replacement token', async () => {
        const token = await signJWT({
            username: 'teacher-a', role: 'teacher', tokenVersion: 2, purpose: 'session',
        }, 'a-test-secret-that-is-long-enough');
        const request = new Request('https://api.test/api/account/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ currentPassword: 'TeacherPass123', newPassword: 'NewTeacherPass123' }),
        });
        const response = await handleTeacherRoutes(request, env('cookie'), '/api/account/change-password', 'POST');
        expect((await response.json() as any).data.token).toBeUndefined();
        expect(response.headers.get('Set-Cookie')).toContain('auth_token=');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('issues a student cookie without exposing the token in cookie mode', async () => {
        const response = await authenticateStudent(env('cookie'), 'student-a', 'StudentPass123');
        const body = await response.json() as any;
        expect(body.data.token).toBeUndefined();
        expect(body.data).toMatchObject({ studentId: 'student-1', username: 'student-a' });
        expect(response.headers.get('Set-Cookie')).toContain('SameSite=Lax');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });
});
