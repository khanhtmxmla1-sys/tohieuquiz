import { describe, test, expect } from 'vitest';
import { checkAnswer } from '../src/utils/question/scoring.util';

/**
 * Unit Tests for Scoring Engine
 * Focus: Ordering Logic (The "Bulletproof" Test)
 */

describe('Scoring Engine - Ordering Logic', () => {

    const mockOrderingQuestion = {
        type: 'ORDERING',
        questionText: 'Sắp xếp các số theo thứ tự tăng dần',
        correctOrder: [1, 2, 3, 4]
    };

    test('nên trả về Correct khi mảng số khớp hoàn toàn', () => {
        const studentAnswer = [1, 2, 3, 4];
        const result = checkAnswer(mockOrderingQuestion, studentAnswer);
        expect(result.isCorrect).toBe(true);
        expect(result.status).toBe('correct');
    });

    test('nên trả về Wrong khi thứ tự bị sai', () => {
        const studentAnswer = [2, 1, 3, 4];
        const result = checkAnswer(mockOrderingQuestion, studentAnswer);
        expect(result.isCorrect).toBe(false);
        expect(result.status).toBe('wrong');
    });

    test('nên trả về Skipped khi mảng rỗng', () => {
        const result = checkAnswer(mockOrderingQuestion, []);
        expect(result.status).toBe('skipped');
    });

    // CẢNH BÁO TỪ AUDIT: Kiểm tra lỗi lệch kiểu dữ liệu (String vs Number)
    test('nên xử lý được khi mix giữa String và Number (Audit Warning Check)', () => {
        const studentAnswer = ["1", "2", "3", "4"];
        const result = checkAnswer(mockOrderingQuestion, studentAnswer);

        // GHI CHÚ: Nếu test này FAIL, nghĩa là bản FIX_DESIGN.md là cực kỳ cần thiết
        expect(result.isCorrect).toBe(true);
    });

    test('nên xử lý được dữ liệu dạng Object (id/value)', () => {
        const studentAnswer = [
            { id: 1, text: 'Một' },
            { id: 2, text: 'Hai' },
            { id: 3, text: 'Ba' },
            { id: 4, text: 'Bốn' }
        ];
        const result = checkAnswer(mockOrderingQuestion, studentAnswer);
        expect(result.isCorrect).toBe(true);
    });
});

describe('Scoring Engine - MCQ & Short Answer', () => {
    test('MCQ: nên normalize đúng "A." và "A"', () => {
        const q = { type: 'MCQ', correctAnswer: 'A' };
        expect(checkAnswer(q, 'A.').isCorrect).toBe(true);
        expect(checkAnswer(q, 'a').isCorrect).toBe(true);
    });

    test('Short Answer: nên bỏ qua khoảng trắng và xuống dòng', () => {
        const q = { type: 'SHORT_ANSWER', correctAnswer: 'hà nội' };
        expect(checkAnswer(q, '  HÀ NỘI  ').isCorrect).toBe(true);
        expect(checkAnswer(q, 'Hà\nNội').isCorrect).toBe(true);
    });
});
