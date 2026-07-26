import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import { ClassroomDatabase, classroomEnv, classroomRequest } from './fixtures/classroomWorkerFixture';

const { authState, verifyJWTMiddleware } = vi.hoisted(() => ({
    authState: { currentUser: null as JWTPayload | null },
    verifyJWTMiddleware: vi.fn(async () => authState.currentUser
        ? { user: authState.currentUser }
        : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
}));
vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware,
    requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
    requireTeacher: vi.fn((user: JWTPayload) => ['admin', 'teacher'].includes(user.role)),
    isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleClassroomRoutes } from '../workers/src/routes/classroom';

const callRoute = (path: string, method: string, db = new ClassroomDatabase(), body?: string) =>
    handleClassroomRoutes(
        classroomRequest(path, { method, ...(body === undefined ? {} : { body }) }),
        classroomEnv(db), path.split('?')[0], method,
    );

const asStudent = (classId = 'class-a') => {
    authState.currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId };
};

describe('Classroom route contracts', () => {
    beforeEach(() => { authState.currentUser = null; verifyJWTMiddleware.mockClear(); });

    it('keeps student login public before JWT verification', async () => {
        const response = await callRoute('/api/student-login', 'POST', new ClassroomDatabase(), '{}');
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ message: 'Missing username or password' });
        expect(verifyJWTMiddleware).not.toHaveBeenCalled();
    });

    it('protects every non-login route before fallback dispatch', async () => {
        const response = await callRoute('/api/not-a-classroom-route', 'GET');
        expect(response.status).toBe(401);
        expect(verifyJWTMiddleware).toHaveBeenCalledOnce();
    });

    it('keeps non-POST student-login requests behind JWT authentication', async () => {
        const response = await callRoute('/api/student-login', 'GET');
        expect(response.status).toBe(401);
        expect(verifyJWTMiddleware).toHaveBeenCalledOnce();
    });

    it('restores the student cookie session without exposing a token', async () => {
        asStudent();
        const db = new ClassroomDatabase({
            student: {
                id: 'student-a', username: 'student-a', full_name: 'Lan', class_id: 'class-a',
                class_name: '3A', avatar: 'cat', coins: 25, pet_id: null,
            },
            shopItems: [],
        });
        const response = await callRoute('/api/student-profile', 'GET', db);
        const payload = await response.json() as any;

        expect(response.status).toBe(200);
        expect(payload.data).toMatchObject({
            studentId: 'student-a', username: 'student-a', fullName: 'Lan', classId: 'class-a',
        });
        expect(payload.data.token).toBeUndefined();
    });

    it('rejects teacher access to the student profile endpoint', async () => {
        authState.currentUser = { username: 'teacher-a', role: 'teacher' };
        const response = await callRoute('/api/student-profile', 'GET');
        expect(response.status).toBe(403);
    });

    it('hides roster contact metadata from students', async () => {
        asStudent();
        const db = new ClassroomDatabase({
            classroom: { id: 'class-a', teacher_username: 'teacher-a', archived_at: '' },
            students: [{
                id: 'student-a', full_name: 'Lan', username: 'student-a', class_id: 'class-a',
                avatar: '', parent_phone: '0900000000', created_at: '2026-01-01',
            }],
        });
        const response = await callRoute('/api/students?classId=class-a', 'GET', db);
        const payload = await response.json() as any;
        expect(payload.data[0]).toEqual({
            id: 'student-a', fullName: 'Lan', username: 'student-a', classId: 'class-a', avatar: '',
        });
    });

    it('keeps permanent class deletion disabled', async () => {
        authState.currentUser = { username: 'admin-a', role: 'admin' };
        const response = await callRoute('/api/classes/class-a', 'DELETE');
        expect(response.status).toBe(405);
    });

    it('keeps password changes restricted to the matching student', async () => {
        asStudent();
        const db = new ClassroomDatabase({
            student: { id: 'student-b', username: 'student-b', class_id: 'class-a' },
        });
        const response = await callRoute(
            '/api/students/student-b/change-password', 'POST', db,
            JSON.stringify({ currentPassword: 'secret1', newPassword: 'secret2' }),
        );
        expect(response.status).toBe(403);
    });

    it('rejects starting an assignment from another class', async () => {
        asStudent('class-a');
        const db = new ClassroomDatabase({
            student: { id: 'student-a', username: 'student-a', full_name: 'Lan', class_id: 'class-a' },
            assignment: { id: 'assignment-a', class_id: 'class-b', student_id: '', status: 'OPEN' },
        });
        const response = await callRoute('/api/assignments/assignment-a/start', 'POST', db, '{}');
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            message: 'Forbidden: Assignment is not for your class',
        });
    });

    it('keeps authenticated unknown routes on the 404 fallback', async () => {
        authState.currentUser = { username: 'teacher-a', role: 'teacher' };
        const response = await callRoute('/api/classroom/unknown', 'GET');
        expect(response.status).toBe(404);
    });

    it('does not expose D1 details when student batch persistence fails', async () => {
        authState.currentUser = { username: 'teacher-a', role: 'teacher' };
        const db = new ClassroomDatabase({
            classroom: { id: 'class-a', teacher_username: 'teacher-a', archived_at: '' },
            batchError: new Error('D1_ERROR: UNIQUE constraint failed: students.username'),
        });
        const request = classroomRequest('/api/students/batch', {
            method: 'POST',
            headers: { 'x-request-id': 'req-classroom-1' },
            body: JSON.stringify({
                students: [{
                    fullName: 'Nguyễn Văn A', username: 'student-new', password: 'secret12345',
                    classId: 'class-a', parentPhone: '',
                }],
            }),
        });
        const response = await handleClassroomRoutes(
            request,
            classroomEnv(db),
            '/api/students/batch',
            'POST',
        );
        const payload = await response.json() as any;

        expect(response.status).toBe(500);
        expect(payload.message).toBe('Internal server error');
        expect(payload.requestId).toBe('req-classroom-1');
        expect(JSON.stringify(payload)).not.toContain('UNIQUE constraint');
    });
});
