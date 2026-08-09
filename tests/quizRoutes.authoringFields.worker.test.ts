import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import { plainTextToRichText } from '../shared/question-rich-text.contract';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware: vi.fn(async () => currentUser
        ? { user: currentUser }
        : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
    requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
    requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handleQuizRoutes, mapQuestionFromD1, sanitizeQuestionForStudent } from '../workers/src/routes/quizzes';
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
    persistedQuestionCount = 0;
    prepare(sql: string) { return new Statement(sql, this); }
    first(sql: string) {
        if (sql.includes('FROM teachers t')) {
            return { username: 'teacher-a', full_name: 'Cô A', full_name_count: 1 };
        }
        if (sql.includes('SELECT created_by FROM quizzes')) return { created_by: 'teacher-a' };
        if (sql.includes('SELECT COUNT(*) AS count')) return { count: 0 };
        if (sql.includes('SELECT COUNT(*) as cnt FROM questions')) {
            return { cnt: this.persistedQuestionCount };
        }
        if (sql.includes('SELECT * FROM quizzes WHERE id')) {
            return {
                id: 'quiz-a', title: 'Đề gốc', class_level: '4A', category: 'toan',
                time_limit: 20, created_at: '2026-07-21T08:00:00.000Z',
                require_code: 'FALSE', tags: '[]', created_by: 'teacher-a', revision: 1,
            };
        }
        return null;
    }
    all(sql: string) {
        if (!sql.includes('FROM questions')) return [];
        return [{
            id: 'q-old', quiz_id: 'quiz-a', type: 'MCQ', question: '1 + 1 = ?',
            question_rich_text: JSON.stringify(richQuestion),
            options: '1|2', correct_answer: 'B', items: '', text_field: '', blanks: '',
            distractors: '', sentence: '', words: '', correct_word_indexes: '', image: '',
            tags: '', subject: 'toan', skill_code: '', subskill_code: '', difficulty: 1,
            math_format_version: 2, points: 2.5, explanation: 'Vì một cộng một bằng hai.', image_alt: 'Hai khối vuông.',
            svg_content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2" /></svg>',
            svg_alt: 'Một đường tròn.',
        }];
    }
    async batch(statements: Statement[]) {
        this.persistedQuestionCount = statements.filter((statement) =>
            statement.sql.includes('INSERT INTO questions'),
        ).length;
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

const richQuestion = plainTextToRichText('1 + 1 = ?');
richQuestion.doc.content[0] = {
    type: 'paragraph',
    attrs: { textAlign: 'center' },
    content: [{ type: 'text', text: '1 + 1 = ?', marks: [{ type: 'bold' }] }],
};

const question = {
    id: 'q-1', type: 'MCQ', question: '1 + 1 = ?', questionRichText: richQuestion, options: ['1', '2'],
    correctAnswer: 'B', difficulty: 1, points: 2.5,
    explanation: 'Vì một cộng một bằng hai.', imageAlt: 'Hai khối vuông.',
    svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2" /></svg>',
    svgAlt: 'Một đường tròn.', svgVersion: 1 as const,
};

beforeEach(() => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
});

describe('quiz authoring points and explanations', () => {
    it('maps rich presentation into a dedicated persisted column without changing plain question semantics', () => {
        const mapped = mapQuestionForSave(question, 'quiz-a');
        expect(mapped).toHaveLength(27);
        expect(mapped[3]).toBe('1 + 1 = ?');
        expect(JSON.parse(mapped[4])).toEqual(richQuestion);
        expect(mapped.slice(-6)).toEqual([
            '2.5', 'Vì một cộng một bằng hai.', 'Hai khối vuông.',
            expect.stringContaining('<svg'), 'Một đường tròn.', '2',
        ]);
    });

    it('persists the rich-derived prompt instead of a stale plain echo', () => {
        const rich = plainTextToRichText('Nội dung từ rich');
        const mapped = mapQuestionForSave({
            id: 'q-drift', type: 'MCQ', question: 'Nội dung stale', questionRichText: rich,
            options: ['A', 'B'], correctAnswer: 'A',
        } as any, 'quiz-a');

        expect(mapped[3]).toBe('Nội dung từ rich');
        expect(JSON.parse(mapped[4])).toEqual(rich);
    });

    it('uses rich content as the TRUE_FALSE main prompt authority', () => {
        const rich = plainTextToRichText('Đọc dữ kiện rich');
        const mapped = mapQuestionForSave({
            id: 'tf-rich', type: 'TRUE_FALSE', mainQuestion: 'Stale main', question: 'Stale question',
            questionRichText: rich,
            items: [{ id: 'tf-1', statement: 'Mệnh đề', isCorrect: true }],
        } as any, 'quiz-a');

        expect(mapped[3]).toBe('Đọc dữ kiện rich');
    });

    it('validates one flattened rich formula even when marks split its text nodes', () => {
        const rich = {
            schemaVersion: 1 as const,
            doc: {
                type: 'doc' as const,
                content: [{
                    type: 'paragraph' as const,
                    content: [
                        { type: 'text' as const, text: 'Tính $' },
                        { type: 'text' as const, text: 'x', marks: [{ type: 'bold' as const }] },
                        { type: 'text' as const, text: '^2$' },
                    ],
                }],
            },
        };

        const mapped = mapQuestionForSave({
            id: 'q-split-rich', type: 'MCQ', question: 'Tính x bình phương', questionRichText: rich,
            options: ['A', 'B'], correctAnswer: 'A',
        } as any, 'quiz-a');

        expect(mapped[3]).toContain('x^2');
        expect(JSON.parse(mapped[4])).toEqual(rich);
    });

    it('rejects malformed math from the flattened rich prompt instead of trusting a benign plain echo', () => {
        const rich = plainTextToRichText('Tính $x^2');
        expect(() => mapQuestionForSave({
            id: 'q-math-rich', type: 'MCQ', question: '2 + 2 = ?', questionRichText: rich,
            options: ['4', '5'], correctAnswer: 'A',
        } as any, 'quiz-a')).toThrow();
    });

    it('emits one metadata-only event when submitted plain text disagrees with rich content', () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const rich = plainTextToRichText('Nội dung rich');

        mapQuestionForSave({
            id: 'q-drift-log', type: 'MCQ', question: 'Nội dung khác', questionRichText: rich,
            options: ['A', 'B'], correctAnswer: 'A',
        } as any, 'quiz-a');

        const driftEvents = info.mock.calls
            .map(([message]) => {
                try { return JSON.parse(String(message)); } catch { return null; }
            })
            .filter((event) => event?.event === 'question_rich_text_plain_mismatch');
        expect(driftEvents).toEqual([{ event: 'question_rich_text_plain_mismatch', questionType: 'MCQ' }]);
        expect(JSON.stringify(driftEvents)).not.toContain('Nội dung');
        info.mockRestore();
    });

    it('does not emit drift for matching, omitted, or math-normalization-equivalent plain echoes', () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const matching = plainTextToRichText('Nội dung A');
        mapQuestionForSave({
            id: 'q-match', type: 'MCQ', question: 'Nội dung A', questionRichText: matching,
            options: ['A', 'B'], correctAnswer: 'A',
        } as any, 'quiz-a');

        mapQuestionForSave({
            id: 'q-omitted', type: 'MCQ', questionRichText: matching,
            options: ['A', 'B'], correctAnswer: 'A',
        } as any, 'quiz-a');

        const fraction = String.raw`\frac{1}{2}`;
        const mathRich = plainTextToRichText(`Tính ${fraction}`);
        mapQuestionForSave({
            id: 'q-math-equivalent', type: 'MCQ', question: `Tính $${fraction}$`, questionRichText: mathRich,
            options: ['A', 'B'], correctAnswer: 'A',
        } as any, 'quiz-a');

        const driftEvents = info.mock.calls
            .map(([message]) => {
                try { return JSON.parse(String(message)); } catch { return null; }
            })
            .filter((event) => event?.event === 'question_rich_text_plain_mismatch');
        expect(driftEvents).toEqual([]);
        info.mockRestore();
    });

    it('persists authoring fields on quiz creation', async () => {
        const db = new Database();
        const response = await handleQuizRoutes(request('/api/quizzes', 'POST', {
            id: 'quiz-a', title: 'Đề Toán', classLevel: '4A', category: 'toan',
            timeLimit: 20, createdAt: '2026-07-21T08:00:00.000Z', questions: [question],
        }), env(db), '/api/quizzes', 'POST');

        expect(response.status).toBe(200);
        const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO questions'));
        expect(insert?.sql).toContain('question, question_rich_text, options');
        expect(insert?.sql).toContain('points, explanation, image_alt');
        expect(insert?.sql).toContain('svg_content, svg_alt');
        expect(insert?.bindings).toHaveLength(27);
        expect(JSON.parse(String(insert?.bindings[4]))).toEqual(richQuestion);
        expect(insert?.bindings.slice(-6)).toEqual([
            '2.5', 'Vì một cộng một bằng hai.', 'Hai khối vuông.',
            expect.stringContaining('<svg'), 'Một đường tròn.', '2',
        ]);
    });

    it('accepts a short answer when correctAnswers is empty but correctAnswer is present', async () => {
        const db = new Database();
        const response = await handleQuizRoutes(request('/api/quizzes/quiz-a', 'PUT', {
            id: 'quiz-a', title: 'Đề Tiếng Anh', classLevel: '4', category: 'tieng-anh',
            timeLimit: 25, revision: 1, questions: [{
                id: 'short-1', type: 'SHORT_ANSWER', question: 'The cap is ____.',
                correctAnswer: 'mine', correctAnswers: [], points: 1,
            }],
        }), env(db), '/api/quizzes/quiz-a', 'PUT');

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            status: 'success', questionCount: 1, revision: 2,
        });
        const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO questions'));
        expect(insert?.bindings[6]).toBe('mine');
    });

    it('returns a readable Vietnamese message for invalid scoring contracts', async () => {
        const db = new Database();
        const response = await handleQuizRoutes(request('/api/quizzes/quiz-a', 'PUT', {
            id: 'quiz-a', title: 'Đề Tiếng Anh', classLevel: '4', category: 'tieng-anh',
            timeLimit: 25, revision: 1, questions: [{
                id: 'short-empty', type: 'SHORT_ANSWER', question: 'The cap is ____.',
                correctAnswer: '', correctAnswers: [], points: 1,
            }],
        }), env(db), '/api/quizzes/quiz-a', 'PUT');

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            status: 'error',
            code: 'INVALID_QUESTION_SCORING_CONTRACT',
            message: 'Một hoặc nhiều câu hỏi chưa có hợp đồng đáp án hợp lệ để chấm tự động.',
            issues: [expect.objectContaining({
                questionId: 'short-empty', code: 'MISSING_CORRECT_ANSWER',
            })],
        });
    });

    it('rejects unsupported rich presentation before executing any D1 write', async () => {
        const db = new Database();
        const response = await handleQuizRoutes(request('/api/quizzes', 'POST', {
            id: 'quiz-a', title: 'Đề Toán', classLevel: '4A', category: 'toan',
            timeLimit: 20, questions: [{
                ...question,
                questionRichText: {
                    schemaVersion: 1,
                    doc: {
                        type: 'doc',
                        content: [{
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'X', marks: [{ type: 'link' }] }],
                        }],
                    },
                },
            }],
        }), env(db), '/api/quizzes', 'POST');

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            status: 'error',
            code: 'INVALID_QUESTION_RICH_TEXT',
        });
        expect(db.executed.some((statement) => statement.sql.includes('INSERT INTO questions'))).toBe(false);
    });

    it('maps valid D1 rich JSON to camelCase and drops the raw storage field', () => {
        const mapped = mapQuestionFromD1({
            id: 'q-rich',
            type: 'MCQ',
            question: '1 + 1 = ?',
            question_rich_text: JSON.stringify(richQuestion),
        });
        expect(mapped.questionRichText).toEqual(richQuestion);
        expect(mapped).not.toHaveProperty('question_rich_text');
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
        expect(insert?.bindings).toHaveLength(27);
        expect(JSON.parse(String(insert?.bindings[4]))).toEqual(richQuestion);
        expect(insert?.bindings.slice(-6)).toEqual([
            '2.5', 'Vì một cộng một bằng hai.', 'Hai khối vuông.',
            expect.stringContaining('<svg'), 'Một đường tròn.', '1',
        ]);
    });

    it('hides explanations from students while keeping non-secret points and rich presentation', () => {
        const safe = sanitizeQuestionForStudent({
            ...question,
            correct_answer: 'B',
            points: 2.5,
            explanation: 'Lời giải bí mật',
            question_rich_text: JSON.stringify(richQuestion),
        });
        expect(safe).not.toHaveProperty('correct_answer');
        expect(safe).not.toHaveProperty('explanation');
        expect(safe.points).toBe(2.5);
        expect(safe.questionRichText).toEqual(richQuestion);
        expect(safe).not.toHaveProperty('question_rich_text');
    });

    it('keeps old questions valid when authoring fields are absent', () => {
        const mapped = mapQuestionForSave({
            id: 'q-old', type: 'MCQ', question: 'Câu cũ', options: ['A', 'B'], correctAnswer: 'A',
        }, 'quiz-a');
        expect(mapped).toHaveLength(27);
        expect(mapped[4]).toBe('');
        expect(mapped.slice(-6)).toEqual(['', '', '', '', '', '2']);
    });
});
