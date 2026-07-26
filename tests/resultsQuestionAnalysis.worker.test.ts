import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload;

vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
    requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
    requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
    isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleResultRoutes } from '../workers/src/routes/results';

class FakeStatement {
    bindings: unknown[] = [];

    constructor(
        readonly sql: string,
        readonly database: FakeDatabase,
    ) {}

    bind(...bindings: unknown[]) {
        this.bindings = bindings;
        return this;
    }

    async all<T>() {
        this.database.executed.push(this);
        return { results: this.database.rows as T[] };
    }
}

class FakeDatabase {
    executed: FakeStatement[] = [];
    rows = [
        { id: 'result-1', answers: '{"q1":{"selectedAnswer":"A","isCorrect":false}}' },
    ];

    prepare(sql: string) {
        return new FakeStatement(sql, this);
    }
}

describe('bulk result answers authorization', () => {
    beforeEach(() => {
        currentUser = { username: 'teacher-1', role: 'teacher' } as JWTPayload;
    });

    it('returns only rows from classes owned by the teacher', async () => {
        const database = new FakeDatabase();
        const response = await handleResultRoutes(
            new Request('https://example.test/api/results/answers/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resultIds: ['result-1'] }),
            }),
            { DB: database } as any,
            '/api/results/answers/bulk',
            'POST',
        );
        const payload = await response.json() as any;

        expect(response.status).toBe(200);
        expect(payload.data['result-1']).toContain('selectedAnswer');
        expect(database.executed[0].sql).toContain('teacher_username = ?');
        expect(database.executed[0].bindings).toEqual(['result-1', 'teacher-1']);
    });

    it('rejects students and invalid batches before querying D1', async () => {
        const studentDatabase = new FakeDatabase();
        currentUser = { username: 'student-1', role: 'student' } as JWTPayload;
        const forbidden = await handleResultRoutes(
            new Request('https://example.test/api/results/answers/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resultIds: ['result-1'] }),
            }),
            { DB: studentDatabase } as any,
            '/api/results/answers/bulk',
            'POST',
        );
        expect(forbidden.status).toBe(403);
        expect(studentDatabase.executed).toHaveLength(0);

        currentUser = { username: 'teacher-1', role: 'teacher' } as JWTPayload;
        const invalidDatabase = new FakeDatabase();
        const invalid = await handleResultRoutes(
            new Request('https://example.test/api/results/answers/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resultIds: ['duplicate', 'duplicate'] }),
            }),
            { DB: invalidDatabase } as any,
            '/api/results/answers/bulk',
            'POST',
        );
        expect(invalid.status).toBe(400);
        expect(invalidDatabase.executed).toHaveLength(0);
    });
});
