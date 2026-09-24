import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { getQuestionOverviewRows } from '../src/features/manual-quiz-workspace/overview/questionOverviewModel';
import type { ManualQuizQuestion } from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';

const question = (id: string, text: string, type = QuestionType.MCQ, points = 1): ManualQuizQuestion => ({
    id,
    type,
    question: text,
    options: ['A', 'B'],
    correctAnswer: 'A',
    difficulty: 1,
    points,
});

describe('getQuestionOverviewRows', () => {
    it('maps question validation issues to ready and needs-fix rows', () => {
        const rows = getQuestionOverviewRows(
            [question('q-1', 'Câu thứ nhất'), question('q-2', 'Câu thứ hai')],
            [{ code: 'QUESTION_EMPTY', severity: 'error', message: 'Thiếu nội dung', questionId: 'q-2' }],
        );

        expect(rows.map((row) => [row.number, row.status])).toEqual([
            [1, 'ready'],
            [2, 'needs-fix'],
        ]);
        expect(rows[1].firstIssue?.message).toBe('Thiếu nội dung');
    });

    it('keeps warning-only and no-issue questions distinguishable', () => {
        const rows = getQuestionOverviewRows(
            [question('q-1', 'Câu có cảnh báo'), question('q-2', 'Câu ổn')],
            [{ code: 'QUESTION_REVIEW', severity: 'warning', message: 'Nên rà lại', questionId: 'q-1' }],
        );

        expect(rows.map((row) => row.status)).toEqual(['warning', 'ready']);
        expect(rows[0].firstIssue?.severity).toBe('warning');
    });

    it('shows the highest-severity issue first when a question has warnings and errors', () => {
        const rows = getQuestionOverviewRows(
            [question('q-1', 'Câu cần sửa')],
            [
                { code: 'QUESTION_REVIEW', severity: 'warning', message: 'Nên rà lại', questionId: 'q-1' },
                { code: 'QUESTION_EMPTY', severity: 'error', message: 'Thiếu nội dung', questionId: 'q-1' },
            ],
        );

        expect(rows[0].status).toBe('needs-fix');
        expect(rows[0].firstIssue).toMatchObject({ severity: 'error', message: 'Thiếu nội dung' });
    });

    it('keeps original row numbers after question order changes', () => {
        const rows = getQuestionOverviewRows(
            [question('q-2', 'Câu hai'), question('q-1', 'Câu một')],
            [{ code: 'QUESTION_EMPTY', severity: 'error', message: 'Thiếu nội dung', questionId: 'q-1' }],
        );

        expect(rows.map((row) => [row.id, row.number, row.status])).toEqual([
            ['q-2', 1, 'ready'],
            ['q-1', 2, 'needs-fix'],
        ]);
    });

    it('does not apply quiz-level issues to every question', () => {
        const rows = getQuestionOverviewRows(
            [question('q-1', 'Câu một'), question('q-2', 'Câu hai')],
            [{ code: 'QUIZ_POINTS_MISMATCH', severity: 'warning', message: 'Tổng điểm chưa khớp' }],
        );

        expect(rows.every((row) => row.status === 'ready')).toBe(true);
        expect(rows.every((row) => row.firstIssue === undefined)).toBe(true);
    });

    it('exposes a two-line label, type label and points metadata', () => {
        const rows = getQuestionOverviewRows([
            question('q-1', 'Câu trắc nghiệm', QuestionType.MCQ, 2),
            {
                ...question('q-2', '', QuestionType.TRUE_FALSE, 0.5),
                mainQuestion: 'Mệnh đề đúng sai',
                items: [],
            } as ManualQuizQuestion,
        ], []);

        expect(rows[0]).toMatchObject({
            id: 'q-1',
            label: 'Câu trắc nghiệm',
            type: 'Trắc nghiệm',
            points: 2,
        });
        expect(rows[1]).toMatchObject({
            id: 'q-2',
            label: 'Mệnh đề đúng sai',
            type: 'Đúng/Sai',
            points: 0.5,
        });
    });
});
