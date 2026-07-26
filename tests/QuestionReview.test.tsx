import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import QuestionReview from '../src/components/common/QuestionReview';

// Mock better-react-mathjax to avoid requiring MathJaxContext in unit tests
vi.mock('better-react-mathjax', () => ({
    MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock MathJax global
global.window.MathJax = {
    typesetPromise: vi.fn().mockResolvedValue(undefined)
};

// Mock Lucide icons to avoid rendering complexities in test
vi.mock('lucide-react', () => ({
    CheckCircle: () => <div data-testid="icon-correct" />,
    XCircle: () => <div data-testid="icon-wrong" />,
    MinusCircle: () => <div data-testid="icon-skipped" />,
    ChevronDown: () => <div data-testid="icon-chevron" />
}));

describe('QuestionReview Component', () => {

    describe('MCQ (Trắc nghiệm)', () => {
        const mockMCQ = {
            type: 'MCQ',
            questionText: 'Số nào là số nguyên tố?',
            options: [
                { text: '4' },
                { text: '2' },
                { text: '9' }
            ],
            correctAnswer: 'B',
            explanation: '2 là số nguyên tố duy nhất chẵn.'
        };

        it('nên hiển thị đúng khi học sinh chọn ĐÚNG', () => {
            render(<QuestionReview index={0} question={mockMCQ} studentAnswer="B" />);

            expect(document.querySelector('.review-question-number')?.textContent).toContain('1');
            expect(document.querySelector('.question-text-inline')?.textContent).toBeTruthy();
            expect(screen.getByTestId('icon-correct')).toBeDefined();
            expect(document.querySelector('.correct-indicator')).toBeTruthy();
        });

        it('nên hiển thị đúng khi học sinh chọn SAI', () => {
            render(<QuestionReview index={1} question={mockMCQ} studentAnswer="A" />);

            expect(screen.getByTestId('icon-wrong')).toBeDefined();
            expect(document.querySelector('.choice-indicator')).toBeTruthy();
            expect(document.querySelector('.correct-indicator')).toBeTruthy(); // Correct answer badge should appear
        });
    });

    describe('SHORT_ANSWER (Trả lời ngắn)', () => {
        const mockShortAnswer = {
            type: 'SHORT_ANSWER',
            questionText: 'Thủ đô của Việt Nam là gì?',
            correctAnswer: 'Hà Nội'
        };

        it('nên hiển thị đúng khi học sinh trả lời ĐÚNG (có normalize)', () => {
            render(<QuestionReview index={0} question={mockShortAnswer} studentAnswer="  hà nội  " />);
            expect(screen.getByTestId('icon-correct')).toBeDefined();
        });

        it('nên hiển thị đúng khi học sinh trả lời SAI', () => {
            render(<QuestionReview index={0} question={mockShortAnswer} studentAnswer="TP HCM" />);
            expect(screen.getByTestId('icon-wrong')).toBeDefined();
            expect(document.querySelector('.answer-row.correct-row .value')?.textContent).toBeTruthy();
        });
    });

    describe('ORDERING (Sắp xếp)', () => {
        const mockOrdering = {
            type: 'ORDERING',
            questionText: 'Sắp xếp thứ tự tăng dần',
            correctOrder: [1, 2, 0],
            items: ['Ba', 'Một', 'Hai'] // Index 1: Một, Index 2: Hai, Index 0: Ba
        };

        it('nên hiển thị đúng khi học sinh sắp xếp ĐÚNG', () => {
            // Đáp án học sinh gửi lên dạng mảng các index: [1, 2, 0] tương ứng Một, Hai, Ba
            render(<QuestionReview index={0} question={mockOrdering} studentAnswer={[1, 2, 0]} />);
            expect(screen.getByTestId('icon-correct')).toBeDefined();
        });
    });

    describe('MATCHING (Nối cặp)', () => {
        const mockMatching = {
            type: 'MATCHING',
            questionText: 'Nối từ tiếng Anh với nghĩa tiếng Việt',
            pairs: [
                { left: 'Hello', right: 'Xin chào' },
                { left: 'Goodbye', right: 'Tạm biệt' }
            ]
        };

        it('nên hiển thị đúng khi học sinh nối ĐÚNG', () => {
            const studentAnswer = { 'Hello': 'Xin chào', 'Goodbye': 'Tạm biệt' };
            render(<QuestionReview index={0} question={mockMatching} studentAnswer={studentAnswer} />);
            expect(screen.getAllByTestId('icon-correct').length).toBeGreaterThan(0);
        });
    });

    describe('UNDERLINE (Gạch chân)', () => {
        const mockUnderline = {
            type: 'UNDERLINE',
            questionText: 'Gạch chân dưới các danh từ',
            words: ['Con', 'mèo', 'đang', 'ngủ'],
            correctWordIndexes: [0, 1]
        };

        it('nên hiển thị đúng khi học sinh chọn ĐÚNG', () => {
            render(<QuestionReview index={0} question={mockUnderline} studentAnswer={[0, 1]} />);
            expect(screen.getByTestId('icon-correct')).toBeDefined();
        });
    });

    describe('Trường hợp đặc biệt: Status Override', () => {
        const mockMCQ = {
            type: 'MCQ',
            questionText: 'Test Status',
            options: [{ text: 'A' }],
            correctAnswer: 'A'
        };

        it('nên ưu tiên status truyền từ prop thay vì tự tính toán', () => {
            // Thực tế là ĐÚNG (A === A), nhưng truyền status="wrong" từ bên ngoài
            render(<QuestionReview index={0} question={mockMCQ} studentAnswer="A" status="wrong" />);
            expect(screen.getByTestId('icon-wrong')).toBeDefined();
            expect(screen.queryByTestId('icon-correct')).toBeNull();
        });
    });

    describe('TRUE_FALSE (Đúng/Sai)', () => {
        const mockTF = {
            type: 'TRUE_FALSE',
            questionText: 'Mặt trời mọc ở hướng Đông?',
            correctAnswer: 'Đúng'
        };

        it('nên hiển thị đúng khi học sinh trả lời ĐÚNG', () => {
            render(<QuestionReview index={0} question={mockTF} studentAnswer="Đúng" />);
            expect(screen.getByTestId('icon-correct')).toBeDefined();
        });
    });

    describe('WORD_SCRAMBLE (Ghép từ)', () => {
        const mockScramble = {
            type: 'WORD_SCRAMBLE',
            questionText: 'Ghép thành từ có nghĩa',
            letters: ['H', 'E', 'L', 'L', 'O'],
            correctWord: 'HELLO'
        };

        it('nên hiển thị đúng khi học sinh ghép SAI', () => {
            // studentAnswer cho WORD_SCRAMBLE thường là mảng các index
            render(<QuestionReview index={0} question={mockScramble} studentAnswer={[0, 1, 2]} />); // HEL
            expect(screen.getByTestId('icon-wrong')).toBeDefined();
            expect(screen.getByText('HELLO')).toBeDefined(); // Hiển thị đáp án đúng
        });
    });

    describe('Trạng thái Bỏ qua (Skipped)', () => {
        const mockMCQ = {
            type: 'MCQ',
            questionText: 'Câu hỏi bỏ qua',
            options: [{ text: 'A' }],
            correctAnswer: 'A'
        };

        it('nên hiển thị icon Bỏ qua khi studentAnswer rỗng hoặc undefined', () => {
            render(<QuestionReview index={0} question={mockMCQ} studentAnswer={undefined} />);
            expect(screen.getByTestId('icon-skipped')).toBeDefined();
            expect(document.querySelector('.question-review-card.skipped')).toBeTruthy();
        });
    });

    describe('Hiển thị giải thích (Explanation)', () => {
        const mockQuestion = {
            type: 'MCQ',
            questionText: 'Test Explanation',
            options: [{ text: 'A' }],
            correctAnswer: 'A',
            explanation: 'Đây là lời giải chi tiết.'
        };

        it('nên hiển thị giải thích khi showExplanation=true', () => {
            render(<QuestionReview index={0} question={mockQuestion} studentAnswer="A" showExplanation={true} />);
            expect(document.querySelector('.explanation-title')).toBeTruthy();
            expect(document.querySelector('.explanation-section')?.textContent).toBeTruthy();
        });

        it('nên ẩn giải thích khi showExplanation=false', () => {
            render(<QuestionReview index={0} question={mockQuestion} studentAnswer="A" showExplanation={false} />);
            expect(document.querySelector('.explanation-section')).toBeNull();
        });
    });
});
