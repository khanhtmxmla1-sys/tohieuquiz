import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware: vi.fn(async () => currentUser
        ? { user: currentUser }
        : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
    requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
    requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handleQuizRoutes, sanitizeQuestionForStudent } from '../workers/src/routes/quizzes';
import { mapQuestionForSave } from '../workers/src/utils/helpers';

class Statement {
    bindings: unknown[] = [];
    constructor(readonly sql: string, readonly db: Database) {}
    bind(...values: unknown[]) { this.bindings = values; return this; }
    async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
    async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql, this.bindings) as T[] }; }
    async run() { this.db.executed.push(this); return { success: true, meta: { changes: 1 } }; }
}

class Database {
    executed: Statement[] = [];
    prepare(sql: string) { return new Statement(sql, this); }
    first(sql: string) {
        if (sql.includes('FROM teachers t')) {
            return { username: 'teacher-a', full_name: 'Cô A', full_name_count: 1 };
        }
        if (sql.includes('SELECT created_by FROM quizzes')) return { created_by: 'teacher-a' };
        if (sql.includes('SELECT * FROM quizzes WHERE id')) {
            return {
                id: 'quiz-a', title: 'Đề gốc', class_level: '4A', category: 'toan',
                time_limit: 20, created_at: '2026-07-21T08:00:00.000Z',
                require_code: 'FALSE', tags: '[]', created_by: 'teacher-a',
            };
        }
        return null;
    }
    all(sql: string) {
        if (!sql.includes('FROM questions')) return [];
        return [{
            id: 'q-old', quiz_id: 'quiz-a', type: 'MCQ', question: '1 + 1 = ?',
            options: '1|2', correct_answer: 'B', items: '', text_field: '', blanks: '',
            distractors: '', sentence: '', words: '', correct_word_indexes: '', image: '',
            tags: '', subject: 'toan', skill_code: '', subskill_code: '', difficulty: 1,
            math_format_version: 2, points: 2.5, explanation: 'Vì một cộng một bằng hai.', image_alt: 'Hai khối vuông.',
        }];
    }
    async batch(statements: Statement[]) {
        this.executed.push(...statements);
        return statements.map(() => ({ success: true }));
    }
}

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const request = (path: string, method: string, body?: unknown) => new Request(`https://test${path}`, {
    method,
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
});

const question = {
    id: 'q-1', type: 'MCQ', question: '1 + 1 = ?', options: ['1', '2'],
    correctAnswer: 'B', difficulty: 1, points: 2.5,
    explanation: 'Vì một cộng một bằng hai.', imageAlt: 'Hai khối vuông.',
};

beforeEach(() => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
});

describe('quiz authoring points and explanations', () => {
    it('maps points and explanation as the final persisted question fields', () => {
        const mapped = mapQuestionForSave(question, 'quiz-a');
        expect(mapped).toHaveLength(23);
        expect(mapped.slice(-3)).toEqual(['2.5', 'Vì một cộng một bằng hai.', 'Hai khối vuông.']);
    });

    it('persists authoring fields on quiz creation', async () => {
        const db = new Database();
        const response = await handleQuizRoutes(request('/api/quizzes', 'POST', {
            id: 'quiz-a', title: 'Đề Toán', classLevel: '4A', category: 'toan',
            timeLimit: 20, createdAt: '2026-07-21T08:00:00.000Z', questions: [question],
        }), env(db), '/api/quizzes', 'POST');

        expect(response.status).toBe(200);
        const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO questions'));
        expect(insert?.sql).toContain('points, explanation, image_alt');
        expect(insert?.bindings.slice(-3)).toEqual(['2.5', 'Vì một cộng một bằng hai.', 'Hai khối vuông.']);
    });

    it('keeps authoring fields when duplicating a quiz', async () => {
        const db = new Database();
        const response = await handleQuizRoutes(
            request('/api/quizzes/quiz-a/duplicate', 'POST'),
            env(db), '/api/quizzes/quiz-a/duplicate', 'POST',
        );

        expect(response.status).toBe(200);
        const insert = db.executed.find((statement) =>
            statement.sql.includes('INSERT INTO questions') && statement.bindings.length > 0,
        );
        expect(insert?.bindings.slice(-3)).toEqual(['2.5', 'Vì một cộng một bằng hai.', 'Hai khối vuông.']);
    });

    it('hides explanations from students while keeping non-secret points', () => {
        const safe = sanitizeQuestionForStudent({
            ...question,
            correct_answer: 'B',
            points: 2.5,
            explanation: 'Lời giải bí mật',
        });
        expect(safe).not.toHaveProperty('correct_answer');
        expect(safe).not.toHaveProperty('explanation');
        expect(safe.points).toBe(2.5);
    });

    it('keeps old questions valid when authoring fields are absent', () => {
        const mapped = mapQuestionForSave({
            id: 'q-old', type: 'MCQ', question: 'Câu cũ', options: ['A', 'B'], correctAnswer: 'A',
        }, 'quiz-a');
        expect(mapped.slice(-3)).toEqual(['', '', '']);
    });
});
