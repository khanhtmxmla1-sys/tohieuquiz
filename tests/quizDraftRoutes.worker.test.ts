import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import type { ManualQuizDraftPayload } from '../shared/manual-quiz-draft.contract';

let currentUser: JWTPayload | null = null;

vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware: vi.fn(async () => currentUser
        ? { user: currentUser }
        : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
    requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
    requireOwnership: vi.fn((user: JWTPayload, owner: string) => user.role === 'admin' || user.username === owner),
}));

import { handleQuizDraftRoutes } from '../workers/src/routes/quizDrafts';

type QuizDraftRow = {
    id: string;
    owner_username: string;
    quiz_id: string | null;
    draft_json: string;
    revision: number;
    created_at: string;
    updated_at: string;
    expires_at: string | null;
};

class FakeStatement {
    bindings: unknown[] = [];

    constructor(readonly sql: string, readonly db: FakeDatabase) {}

    bind(...values: unknown[]) {
        this.bindings = values;
        return this;
    }

    async first<T>() {
        this.db.executed.push(this);
        if (this.sql.includes('FROM quiz_drafts') && this.sql.includes('WHERE id = ?')) {
            return (this.db.row?.id === this.bindings[0] ? this.db.row : null) as T | null;
        }
        return null;
    }

    async run() {
        this.db.executed.push(this);
        if (this.sql.includes('INSERT INTO quiz_drafts')) {
            const [id, owner, quizId, draftJson, revision, createdAt, updatedAt, expiresAt] = this.bindings;
            this.db.row = {
                id: String(id),
                owner_username: String(owner),
                quiz_id: quizId ? String(quizId) : null,
                draft_json: String(draftJson),
                revision: Number(revision),
                created_at: String(createdAt),
                updated_at: String(updatedAt),
                expires_at: expiresAt ? String(expiresAt) : null,
            };
            return { success: true, meta: { changes: 1 } };
        }
        if (this.sql.includes('UPDATE quiz_drafts')) {
            const [quizId, draftJson, revision, updatedAt, expiresAt, id, expectedRevision] = this.bindings;
            if (!this.db.row || this.db.row.id !== id || this.db.row.revision !== Number(expectedRevision)) {
                return { success: true, meta: { changes: 0 } };
            }
            this.db.row = {
                ...this.db.row,
                quiz_id: quizId ? String(quizId) : null,
                draft_json: String(draftJson),
                revision: Number(revision),
                updated_at: String(updatedAt),
                expires_at: expiresAt ? String(expiresAt) : null,
            };
            return { success: true, meta: { changes: 1 } };
        }
        if (this.sql.includes('DELETE FROM quiz_drafts')) {
            const changed = this.db.row?.id === this.bindings[0];
            if (changed) this.db.row = null;
            return { success: true, meta: { changes: changed ? 1 : 0 } };
        }
        return { success: true, meta: { changes: 0 } };
    }
}

class FakeDatabase {
    row: QuizDraftRow | null = null;
    executed: FakeStatement[] = [];

    prepare(sql: string) {
        return new FakeStatement(sql, this);
    }
}

const env = (db: FakeDatabase) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);

const request = (path: string, method = 'GET', body?: unknown) => new Request(`https://test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
    body: body === undefined ? undefined : JSON.stringify(body),
});

const draft = (overrides: Partial<ManualQuizDraftPayload> = {}): ManualQuizDraftPayload => ({
    schemaVersion: 1,
    draftId: 'draft-1',
    ownerUsername: 'spoofed-owner',
    revision: 0,
    quiz: {
        id: 'quiz-manual-1',
        title: 'Đề Toán',
        classLevel: '3A',
        timeLimit: 15,
        questions: [],
        createdAt: '2026-07-21T08:00:00.000Z',
    },
    selectedQuestionId: null,
    targetPoints: 10,
    updatedAt: '2026-07-21T08:00:00.000Z',
    ...overrides,
});

const responseJson = async (response: Response) => await response.json() as any;

beforeEach(() => {
    currentUser = null;
});

describe('quiz draft worker routes', () => {
    it('forbids students before any database access', async () => {
        currentUser = { username: 'student-a', role: 'student', id: 'student-a' };
        const db = new FakeDatabase();

        const response = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1', 'PUT', { expectedRevision: 0, draft: draft() }),
            env(db),
            '/api/quiz-drafts/draft-1',
            'PUT',
        );

        expect(response.status).toBe(403);
        expect(db.executed).toHaveLength(0);
    });

    it('creates revision one with the JWT owner and ignores a spoofed owner', async () => {
        currentUser = { username: 'teacher-a', role: 'teacher' };
        const db = new FakeDatabase();

        const response = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1', 'PUT', { expectedRevision: 0, draft: draft() }),
            env(db),
            '/api/quiz-drafts/draft-1',
            'PUT',
        );
        const payload = await responseJson(response);

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({ id: 'draft-1', ownerUsername: 'teacher-a', revision: 1 });
        expect(payload.draft).toMatchObject({ ownerUsername: 'teacher-a', revision: 1 });
        expect(db.row?.owner_username).toBe('teacher-a');
    });

    it('allows the owner to read but forbids a different teacher', async () => {
        const db = new FakeDatabase();
        db.row = {
            id: 'draft-1', owner_username: 'teacher-a', quiz_id: null,
            draft_json: JSON.stringify({ ...draft(), ownerUsername: 'teacher-a', revision: 2 }),
            revision: 2, created_at: '2026-07-21T08:00:00.000Z',
            updated_at: '2026-07-21T09:00:00.000Z', expires_at: null,
        };
        currentUser = { username: 'teacher-a', role: 'teacher' };

        const ownResponse = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1'), env(db), '/api/quiz-drafts/draft-1', 'GET',
        );
        expect(ownResponse.status).toBe(200);
        expect((await responseJson(ownResponse)).revision).toBe(2);

        currentUser = { username: 'teacher-b', role: 'teacher' };
        const forbidden = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1'), env(db), '/api/quiz-drafts/draft-1', 'GET',
        );
        expect(forbidden.status).toBe(403);
    });

    it('returns a typed conflict with the current server record', async () => {
        currentUser = { username: 'teacher-a', role: 'teacher' };
        const db = new FakeDatabase();
        db.row = {
            id: 'draft-1', owner_username: 'teacher-a', quiz_id: null,
            draft_json: JSON.stringify({ ...draft(), ownerUsername: 'teacher-a', revision: 3 }),
            revision: 3, created_at: '2026-07-21T08:00:00.000Z',
            updated_at: '2026-07-21T10:00:00.000Z', expires_at: null,
        };

        const response = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1', 'PUT', { expectedRevision: 2, draft: draft() }),
            env(db), '/api/quiz-drafts/draft-1', 'PUT',
        );
        const payload = await responseJson(response);

        expect(response.status).toBe(409);
        expect(payload).toMatchObject({ status: 'error', code: 'DRAFT_CONFLICT' });
        expect(payload.current).toMatchObject({ revision: 3, ownerUsername: 'teacher-a' });
        expect(db.executed.some((statement) => statement.sql.includes('UPDATE quiz_drafts'))).toBe(false);
    });

    it('lets an admin update and delete another teacher draft', async () => {
        currentUser = { username: 'admin-a', role: 'admin' };
        const db = new FakeDatabase();
        db.row = {
            id: 'draft-1', owner_username: 'teacher-a', quiz_id: null,
            draft_json: JSON.stringify({ ...draft(), ownerUsername: 'teacher-a', revision: 1 }),
            revision: 1, created_at: '2026-07-21T08:00:00.000Z',
            updated_at: '2026-07-21T08:00:00.000Z', expires_at: null,
        };

        const update = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1', 'PUT', { expectedRevision: 1, draft: draft() }),
            env(db), '/api/quiz-drafts/draft-1', 'PUT',
        );
        expect(update.status).toBe(200);
        expect((await responseJson(update)).revision).toBe(2);
        expect(db.row?.owner_username).toBe('teacher-a');

        const remove = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1', 'DELETE'),
            env(db), '/api/quiz-drafts/draft-1', 'DELETE',
        );
        expect(remove.status).toBe(200);
        expect(await responseJson(remove)).toEqual({ status: 'success', id: 'draft-1' });
        expect(db.row).toBeNull();
    });

    it('rejects invalid and oversized payloads before writing', async () => {
        currentUser = { username: 'teacher-a', role: 'teacher' };
        const db = new FakeDatabase();

        const invalid = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1', 'PUT', { expectedRevision: -1, draft: {} }),
            env(db), '/api/quiz-drafts/draft-1', 'PUT',
        );
        expect(invalid.status).toBe(400);

        const oversizedDraft = draft({
            quiz: {
                id: 'quiz-manual-1', title: 'x'.repeat(1_050_000),
                classLevel: '3A', timeLimit: 15, questions: [],
                createdAt: '2026-07-21T08:00:00.000Z',
            },
        });
        const oversized = await handleQuizDraftRoutes(
            request('/api/quiz-drafts/draft-1', 'PUT', { expectedRevision: 0, draft: oversizedDraft }),
            env(db), '/api/quiz-drafts/draft-1', 'PUT',
        );
        expect(oversized.status).toBe(413);
        expect(db.executed).toHaveLength(0);
    });
});
