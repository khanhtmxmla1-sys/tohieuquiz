import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { executeApiAction } from '../apiClient';
import { ApiError } from '../errors';

const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
    (key: string) => mockStorage[key] ?? null,
);

function mockOk(body: unknown = {}) {
    mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(body), { status: 200 }),
    );
}
function mockError(status: number, body: unknown) {
    mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(body), { status }),
    );
}

beforeEach(() => {
    mockFetch.mockReset();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
});

describe('executeApiAction — method and URL', () => {
    it('GET get_questions has no body, correct URL', async () => {
        mockOk([]);
        await executeApiAction('get_questions', { quizId: 'abc' });
        const [url, init] = mockFetch.mock.calls[0];
        expect(String(url)).toMatch('/api/questions?quizId=abc');
        expect((init as RequestInit).body).toBeUndefined();
        expect((init as RequestInit).method).toBe('GET');
    });

    it('DELETE delete_quiz has no body', async () => {
        mockOk();
        await executeApiAction('delete_quiz', { quizId: 'q1' });
        const [url, init] = mockFetch.mock.calls[0];
        expect(String(url)).toMatch('/api/quizzes/q1');
        expect((init as RequestInit).body).toBeUndefined();
        expect((init as RequestInit).method).toBe('DELETE');
    });

    it('PUT update_quiz sends JSON body', async () => {
        mockOk();
        await executeApiAction('update_quiz', { id: 'q2', title: 'Updated' });
        const [, init] = mockFetch.mock.calls[0];
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body.title).toBe('Updated');
        expect((init as RequestInit).method).toBe('PUT');
    });
});

describe('executeApiAction — auth headers', () => {
    it('uses cookies for student and teacher routes even when legacy tokens remain in storage', async () => {
        mockStorage['tohieuquiz_jwt_token'] = 'student-tok';
        mockStorage['tohieuquiz_teacher_jwt_token'] = 'teacher-tok';
        mockOk({});
        await executeApiAction('get_game_loop_dashboard');
        const [, studentInit] = mockFetch.mock.calls[0];
        expect((studentInit as RequestInit).credentials).toBe('include');
        expect(((studentInit as RequestInit).headers as Record<string, string>).Authorization).toBeUndefined();

        mockOk([]);
        await executeApiAction('get_teachers');
        const [, teacherInit] = mockFetch.mock.calls[1];
        expect((teacherInit as RequestInit).credentials).toBe('include');
        expect(((teacherInit as RequestInit).headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it('drops legacy one-time token fields without sending a bearer header or leaking them into the body', async () => {
        mockOk({ status: 'success' });
        await executeApiAction('change_password', {
            __authToken: 'legacy-password-change-token',
            newPassword: 'Mat-khau-moi-2026',
        });
        const [, init] = mockFetch.mock.calls[0];
        const headers = (init as RequestInit).headers as Record<string, string>;
        const body = JSON.parse((init as RequestInit).body as string);
        expect(headers.Authorization).toBeUndefined();
        expect(body.__authToken).toBeUndefined();
        expect(body.newPassword).toBe('Mat-khau-moi-2026');
    });
});

describe('executeApiAction — canonical phieu REST body', () => {
    it('sends the payload without a legacy GAS action', async () => {
        mockOk({});
        const orig = { submission_id: 's1' };
        await executeApiAction('upsert_phieu', orig);
        const [url, init] = mockFetch.mock.calls[0];
        const body = JSON.parse((init as RequestInit).body as string);
        expect(String(url)).toMatch('/api/phieu');
        expect(body).toEqual(orig);
        expect(body.action).toBeUndefined();
        expect(Object.keys(orig)).toEqual(['submission_id']);
    });
});

describe('executeApiAction — error handling', () => {
    it('preserves the HTTP status on 401 errors', async () => {
        mockError(401, { message: 'Unauthorized' });

        const error = await executeApiAction('get_quizzes').catch((reason) => reason);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({
            status: 401,
            message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        });
    });

    it('uses backend message for 4xx errors with message', async () => {
        mockError(400, { message: 'Validation failed' });
        await expect(executeApiAction('create_quiz', {})).rejects.toThrow('Validation failed');
    });

    it('throws network error on Failed to fetch', async () => {
        mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        await expect(executeApiAction('get_quizzes')).rejects.toThrow(
            'Không thể kết nối mạng. Vui lòng kiểm tra kết nối rồi thử lại.',
        );
    });

    it('throws on unknown action', async () => {
        await expect(executeApiAction('not_an_action')).rejects.toThrow(
            'Unknown API action: not_an_action',
        );
    });
});
