import { describe, expect, it } from 'vitest';
import { mapLiveExamQuestionRow } from '../workers/src/services/liveExamQuestionMapper';
import { calculateStudentScore } from '../src/features/quiz-player/utils/quizScoring';

/**
 * Hồi quy: mapper của thi trực tiếp từng chạy `JSON.parse` lên mọi giá trị `correct_answer`,
 * nên đáp án `"56"` trở thành **số** `56`. `calculateStudentScore` chấm MCQ bằng `===` với
 * đáp án chuỗi của học sinh, nên `"56" === 56` là false và mọi câu đáp án dạng số bị chấm sai.
 * Đo trên production ngày 26/07/2026: học sinh đúng 2/3 câu nhưng nhận score 0, correct_count 0.
 */
const mcqRow = (id: string, correctAnswer: string, options: string) => ({
    id,
    type: 'MCQ',
    question: `Câu ${id}`,
    options,
    correct_answer: correctAnswer,
});

describe('live exam question mapper — đáp án dạng số', () => {
    it('giữ đáp án số ở dạng chuỗi thay vì đổi thành number', () => {
        const question = mapLiveExamQuestionRow(mcqRow('q1', '56', '54|56|58|64')) as any;

        expect(question.correctAnswer).toBe('56');
        expect(typeof question.correctAnswer).toBe('string');
    });

    it('chấm đúng số câu khi đáp án là số', () => {
        const quiz = {
            id: 'quiz-numeric',
            title: 'Đề toán',
            classLevel: '3',
            timeLimit: 10,
            createdAt: '2026-07-26T00:00:00.000Z',
            createdBy: 'test.gv1',
            questions: [
                mapLiveExamQuestionRow(mcqRow('q1', '56', '54|56|58|64')),
                mapLiveExamQuestionRow(mcqRow('q2', '223', '213|223|233|243')),
                mapLiveExamQuestionRow(mcqRow('q3', '4', '2|3|4|5')),
            ],
        } as any;

        const grading = calculateStudentScore(quiz, { q1: '56', q2: '223', q3: '5' });

        expect(grading.correctCount).toBe(2);
        expect(grading.totalItems).toBe(3);
        expect(grading.score).toBeGreaterThan(6);
    });

    it('vẫn parse các đáp án lưu dạng JSON', () => {
        const multipleSelect = mapLiveExamQuestionRow({
            id: 'q4',
            type: 'MULTIPLE_SELECT',
            question: 'Chọn các số chẵn',
            options: '2|3|4|5',
            correct_answer: '["2","4"]',
        }) as any;
        expect(multipleSelect.correctAnswers).toEqual(['2', '4']);

        const ordering = mapLiveExamQuestionRow({
            id: 'q5',
            type: 'ORDERING',
            question: 'Sắp xếp tăng dần',
            items: '["3","1","2"]',
            correct_answer: '["1","2","3"]',
        }) as any;
        expect(ordering.correctOrder).toEqual(['1', '2', '3']);
    });

    it('không nhận nhầm chuỗi mở đầu bằng dấu ngoặc thành JSON hỏng', () => {
        // Đáp án văn bản có thể chứa dấu ngoặc; nếu parse thất bại phải giữ nguyên chuỗi gốc.
        const question = mapLiveExamQuestionRow(
            mcqRow('q6', '[không phải JSON]', 'a|b'),
        ) as any;

        expect(question.correctAnswer).toBe('[không phải JSON]');
    });
});
