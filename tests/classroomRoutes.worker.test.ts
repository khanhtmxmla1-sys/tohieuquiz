import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import { ClassroomDatabase, classroomEnv, classroomRequest } from './fixtures/classroomWorkerFixture';
import { expectConsoleError } from './helpers/expectedConsole';

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
    afterEach(() => { vi.restoreAllMocks(); });
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

    it('archives a class and only currently-active students with the same lifecycle timestamp', async () => {
        authState.currentUser = { username: 'admin-a', role: 'admin' };
        const db = new ClassroomDatabase({
            classroom: { id: 'class-a', name: '4A', teacher_username: 'teacher-a', archived_at: '' },
        });

        const response = await callRoute(
            '/api/classes/class-a/archive',
            'PATCH',
            db,
            JSON.stringify({ archived: true }),
        );

        expect(response.status).toBe(200);
        const classUpdate = db.executed.find(statement => statement.sql.includes('UPDATE classes SET archived_at = ?'));
        const studentUpdate = db.executed.find(statement => statement.sql.includes('UPDATE students SET archived_at = ?'));
        expect(classUpdate?.bindings[0]).toBeTruthy();
        expect(studentUpdate?.bindings[0]).toBe(classUpdate?.bindings[0]);
        expect(studentUpdate?.sql).toContain("COALESCE(archived_at, '') = ''");
        expect(db.executed.some(statement => /DELETE FROM (assignments|results)/i.test(statement.sql))).toBe(false);
    });

    it('restores only students archived by the same class archive event', async () => {
        authState.currentUser = { username: 'admin-a', role: 'admin' };
        const archivedAt = '2026-08-01T10:20:30.000Z';
        const db = new ClassroomDatabase({
            classroom: { id: 'class-a', name: '4A', teacher_username: 'teacher-a', archived_at: archivedAt },
        });

        const response = await callRoute(
            '/api/classes/class-a/archive',
            'PATCH',
            db,
            JSON.stringify({ archived: false }),
        );

        expect(response.status).toBe(200);
        const studentRestore = db.executed.find(statement => statement.sql.includes('UPDATE students SET archived_at = NULL'));
        expect(studentRestore?.sql).toContain('archived_at = ?');
        expect(studentRestore?.bindings).toEqual(['class-a', archivedAt]);
        expect(db.executed.some(statement => /DELETE FROM (assignments|results)/i.test(statement.sql))).toBe(false);
    });

    it.each([
        [{ username: 'teacher-disabled', full_name: 'Teacher Disabled', role: 'teacher', status: 'DISABLED' }, 409],
        [{ username: 'admin-b', full_name: 'Admin B', role: 'admin', status: 'ACTIVE' }, 400],
    ])('rejects an invalid class owner on creation %#', async (teacher, expectedStatus) => {
        authState.currentUser = { username: 'admin-a', role: 'admin' };
        const db = new ClassroomDatabase({ teacher });

        const response = await callRoute(
            '/api/classes',
            'POST',
            db,
            JSON.stringify({ name: '4A', teacherUsername: teacher.username }),
        );

        expect(response.status).toBe(expectedStatus);
        expect(db.executed.some(statement => statement.sql.includes('INSERT INTO classes'))).toBe(false);
    });

    it('allows an active teacher to receive an additional class', async () => {
        authState.currentUser = { username: 'admin-a', role: 'admin' };
        const db = new ClassroomDatabase({
            classroom: { id: 'class-b', name: '4B', teacher_username: 'teacher-old', created_at: '2026-08-01' },
            teacher: { username: 'teacher-a', full_name: 'Teacher A', role: 'teacher', status: 'ACTIVE' },
            conflictClass: { id: 'class-a', name: '4A' },
        });

        const response = await callRoute(
            '/api/classes/class-b/teacher',
            'PATCH',
            db,
            JSON.stringify({ teacherUsername: 'teacher-a' }),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: 'success',
            data: { id: 'class-b', teacherUsername: 'teacher-a' },
        });
        expect(db.executed.some(statement => (
            statement.sql.includes('UPDATE classes SET teacher_username = ?')
            && statement.bindings.includes('teacher-a')
            && statement.bindings.includes('class-b')
        ))).toBe(true);
    });

    it.each([
        [{ username: 'teacher-disabled', full_name: 'Teacher Disabled', role: 'teacher', status: 'DISABLED' }, 409],
        [{ username: 'admin-b', full_name: 'Admin B', role: 'admin', status: 'ACTIVE' }, 400],
    ])('rejects an invalid class transfer recipient %#', async (teacher, expectedStatus) => {
        authState.currentUser = { username: 'admin-a', role: 'admin' };
        const db = new ClassroomDatabase({
            classroom: { id: 'class-b', name: '4B', teacher_username: 'teacher-old', created_at: '2026-08-01' },
            teacher,
        });

        const response = await callRoute(
            '/api/classes/class-b/teacher',
            'PATCH',
            db,
            JSON.stringify({ teacherUsername: teacher.username }),
        );

        expect(response.status).toBe(expectedStatus);
        expect(db.executed.some(statement => statement.sql.includes('UPDATE classes SET teacher_username = ?'))).toBe(false);
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

    it('hides revoked assignments from the student list query', async () => {
        asStudent('class-a');
        const db = new ClassroomDatabase({
            student: { id: 'student-a', username: 'student-a', full_name: 'Lan', class_id: 'class-a' },
        });

        const response = await callRoute('/api/assignments?studentId=student-a', 'GET', db);

        expect(response.status).toBe(200);
        expect(db.executed.some(statement => (
            statement.sql.includes("UPPER(COALESCE(status, 'OPEN')) != 'REVOKED'")
        ))).toBe(true);
    });

    it('rejects starting a revoked assignment from a stale student screen', async () => {
        asStudent('class-a');
        const db = new ClassroomDatabase({
            student: { id: 'student-a', username: 'student-a', full_name: 'Lan', class_id: 'class-a' },
            assignment: {
                id: 'assignment-a', class_id: 'class-a', student_id: '', status: 'REVOKED',
                deadline: '2099-01-01T00:00:00.000Z',
            },
        });

        const response = await callRoute('/api/assignments/assignment-a/start', 'POST', db, '{}');
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            code: 'ASSIGNMENT_REVOKED',
        });
    });

    it('returns assignment-scoped attempt data before a student starts', async () => {
        asStudent('class-a');
        const db = new ClassroomDatabase({
            student: {
                id: 'student-a', username: 'student-a', full_name: 'Lan',
                class_id: 'class-a', class_name: '4A5',
            },
            assignment: {
                id: 'assignment-a', quiz_id: 'quiz-a', class_id: 'class-a', student_id: '',
                status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z', max_attempts: 2,
            },
            attemptCount: 1,
        });

        const response = await callRoute('/api/assignments/assignment-a/start', 'POST', db, '{}');
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: 'success',
            data: {
                assignmentId: 'assignment-a',
                attemptCount: 1,
                maxAttempts: 2,
                remainingAttempts: 1,
                deadline: '2099-01-01T00:00:00.000Z',
                status: 'OPEN',
            },
        });
        const countQuery = db.executed.find(statement => statement.sql.includes('COUNT(*) as cnt'));
        expect(countQuery?.sql).toContain('assignment_id = ?');
        expect(countQuery?.sql).toContain('student_id = ?');
        expect(countQuery?.bindings).toContain('assignment-a');
        expect(countQuery?.bindings).toContain('student-a');
    });

    it('returns a conflict with a stable code when all attempts are used', async () => {
        asStudent('class-a');
        const db = new ClassroomDatabase({
            student: {
                id: 'student-a', username: 'student-a', full_name: 'Lan',
                class_id: 'class-a', class_name: '4A5',
            },
            assignment: {
                id: 'assignment-a', quiz_id: 'quiz-a', class_id: 'class-a', student_id: '',
                status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z', max_attempts: 1,
            },
            attemptCount: 1,
        });

        const response = await callRoute('/api/assignments/assignment-a/start', 'POST', db, '{}');
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            status: 'error',
            code: 'ASSIGNMENT_ATTEMPTS_EXHAUSTED',
            message: 'Em đã hết lượt làm bài này (1/1).',
            attemptCount: 1,
            maxAttempts: 1,
        });
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
        const errorSpy = expectConsoleError();
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
                    fullName: 'Nguyá»…n VÄƒn A', username: 'student-new', password: 'secret12345',
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
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const logged = JSON.parse(String(errorSpy.mock.calls[0][0]));
        expect(logged).toEqual(expect.objectContaining({
            event: 'worker_request_failed',
            requestId: 'req-classroom-1',
            route: '/api/students/batch',
            method: 'POST',
            status: 500,
            errorCode: 'INTERNAL_ERROR',
            context: 'POST /api/students/batch',
            errorName: 'Error',
        }));
        expect(JSON.stringify(logged)).not.toContain('UNIQUE constraint');
        expect(JSON.stringify(logged)).not.toContain('students.username');
    });
});
