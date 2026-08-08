// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { plainTextToRichText } from '../shared/question-rich-text.contract';
import { handlePracticeRoutes } from '../workers/src/routes/practice';
import { loadLiveExamQuiz } from '../workers/src/services/liveExam/quizLoader';

const rich = plainTextToRichText('Câu hỏi rich');
rich.doc.content[0] = {
    type: 'paragraph',
    attrs: { textAlign: 'center' },
    content: [{ type: 'text', text: 'Câu hỏi rich', marks: [{ type: 'bold' }] }],
};

class Statement {
    bindings: unknown[] = [];
    constructor(readonly sql: string, readonly db: FakeDb) {}
    bind(...values: unknown[]) { this.bindings = values; return this; }
    async first<T>() { return this.db.first(this.sql) as T; }
    async all<T>() { return { results: this.db.all(this.sql) as T[] }; }
}

class FakeDb {
    sql: string[] = [];
    prepare(sql: string) { this.sql.push(sql); return new Statement(sql, this); }
    first(sql: string) {
        if (sql.includes('FROM quizzes')) {
            return {
                id: 'quiz-1', title: 'Đề', class_level: '4', time_limit: 20,
                created_at: '2026-08-08T00:00:00.000Z', created_by: 'teacher-a',
            };
        }
        return null;
    }
    all(sql: string) {
        if (sql.includes('FROM questions')) {
            return [{
                id: 'q-1', quiz_id: 'quiz-1', type: 'MCQ', question: 'Câu hỏi plain',
                question_rich_text: JSON.stringify(rich), options: 'A|B', correct_answer: 'A',
                items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
                correct_word_indexes: '', image: '', svg_content: '', svg_alt: '', tags: '#Toan', difficulty: 1,
            }];
        }
        return [];
    }
}

describe('question rich-text explicit read paths', () => {
    it('selects and maps question_rich_text in practice quizzes', async () => {
        const db = new FakeDb();
        const response = await handlePracticeRoutes(
            new Request('https://test/api/practice?topic=Toan&limit=1'),
            { DB: db } as any,
            '/api/practice',
            'GET',
        );
        const payload = await response.json() as any;

        expect(response.status).toBe(200);
        expect(db.sql.find((sql) => sql.includes('FROM questions'))).toContain('question_rich_text');
        expect(payload.questions[0].questionRichText).toEqual(rich);
        expect(payload.questions[0]).not.toHaveProperty('question_rich_text');
    });

    it('selects and maps question_rich_text for live exam loading', async () => {
        const db = new FakeDb();
        const quiz = await loadLiveExamQuiz(db as any, {
            id: 'live-1', quizId: 'quiz-1', title: 'Thi', duration: 20,
            createdAt: '2026-08-08T00:00:00.000Z',
        } as any);

        expect(db.sql.find((sql) => sql.includes('FROM questions'))).toContain('question_rich_text');
        expect((quiz.questions[0] as any).questionRichText).toEqual(rich);
    });
});
