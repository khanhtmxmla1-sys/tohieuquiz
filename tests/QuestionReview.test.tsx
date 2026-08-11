import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import QuestionReview from '../src/components/common/QuestionReview';
import { plainTextToRichText } from '../shared/question-rich-text.contract';

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

        it('renders rich historical prompt instead of a differing plain fallback', () => {
            const questionRichText = plainTextToRichText('Rich historical prompt');
            questionRichText.doc.content[0].content = [{
                type: 'text', text: 'Rich historical prompt', marks: [{ type: 'bold' }],
            }];
            const richQuestion = {
                ...mockMCQ,
                question: 'Plain fallback prompt',
                questionRichText,
            };

            render(<QuestionReview index={0} question={richQuestion} studentAnswer="B" />);

            expect(screen.getByTestId('question-rich-text-renderer')).toBeDefined();
            expect(screen.getByText('Rich historical prompt').closest('strong')).not.toBeNull();
            expect(screen.queryByText('Plain fallback prompt')).toBeNull();
            expect(screen.getByTestId('icon-correct')).toBeDefined();
        });

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

        it('đánh dấu phương án từ đáp án canonical optionId', () => {
            render(<QuestionReview
                index={0}
                question={{ ...mockMCQ, options: ['4', '2', '9'] }}
                studentAnswer={{ type: 'MCQ', optionId: 'option-1' }}
                status="correct"
            />);

            expect(document.querySelector('.choice-indicator')?.parentElement).toHaveTextContent('B.');
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

        it('hiển thị thứ tự từ đáp án canonical ranks', () => {
            render(<QuestionReview
                index={0}
                question={mockOrdering}
                studentAnswer={{ type: 'ORDERING', ranks: { 'item-0': 3, 'item-1': 1, 'item-2': 2 } }}
                status="correct"
            />);

            const studentItems = Array.from(document.querySelectorAll('.student-order .order-item'));
            expect(studentItems.map((item) => item.textContent)).toEqual(expect.arrayContaining([
                expect.stringContaining('Một'),
                expect.stringContaining('Hai'),
                expect.stringContaining('Ba'),
            ]));
            expect(studentItems[0]).toHaveTextContent('Một');
        });
    });

    describe('MULTIPLE_SELECT (Chọn nhiều)', () => {
        it('đánh dấu các phương án từ canonical optionIds', () => {
            render(<QuestionReview
                index={0}
                question={{
                    type: 'MULTIPLE_SELECT', questionText: 'Chọn số lẻ',
                    options: ['1', '2', '3'], correctAnswers: ['A', 'C'],
                }}
                studentAnswer={{ type: 'MULTIPLE_SELECT', optionIds: ['option-0', 'option-2'] }}
                status="correct"
            />);

            expect(document.querySelectorAll('.multiple.student-choice')).toHaveLength(2);
        });
    });

    describe('Question media', () => {
        it('hiển thị ảnh chính và ảnh phương án trong màn hình xem bài', () => {
            render(<QuestionReview
                index={0}
                question={{
                    type: 'IMAGE_QUESTION', questionText: 'Quan sát',
                    image: 'main.png', imageAlt: 'Ảnh chính',
                    options: ['Tròn', 'Vuông'], optionImages: ['circle.png', 'square.png'],
                    correctAnswer: 'A',
                }}
                studentAnswer={{ type: 'IMAGE_QUESTION', optionId: 'option-0' }}
                status="correct"
            />);

            expect(screen.getByRole('img', { name: 'Ảnh chính' })).toBeInTheDocument();
            expect(screen.getByRole('img', { name: 'Đáp án A: Tròn' })).toBeInTheDocument();
            expect(screen.getByRole('img', { name: 'Đáp án B: Vuông' })).toBeInTheDocument();
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
            expect(document.querySelectorAll('.word-item.correct-word')).toHaveLength(2);
            expect(document.querySelector('.word-item.error-underline')).toBeNull();
        });

        it('chuẩn hóa index chuỗi, loại trùng và bỏ index ngoài phạm vi', () => {
            render(<QuestionReview
                index={0}
                question={{ ...mockUnderline, correctWordIndexes: ['1', '1', 99, 'x'] }}
                studentAnswer={['1', '1', 99]}
                status="correct"
            />);

            expect(document.querySelectorAll('.word-item.correct-word')).toHaveLength(1);
            expect(document.querySelectorAll('.word-item.student-selected')).toHaveLength(1);
            expect(document.querySelector('.word-item.error-underline')).toBeNull();
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

        it('không biến chuỗi "false" thành true ở câu nhiều mệnh đề', () => {
            render(<QuestionReview
                index={0}
                question={{
                    type: 'TRUE_FALSE',
                    questionText: 'Chọn đúng sai',
                    items: [{ id: 'a', statement: 'Mệnh đề A', isCorrect: 'false' }],
                }}
                studentAnswer={{ a: false }}
                status="correct"
            />);

            expect(document.querySelector('.tf-item-row.correct')).toBeTruthy();
            expect(document.querySelector('.tf-item-row.wrong')).toBeNull();
        });

        it('hiển thị trung tính khi thiếu đáp án chuẩn thay vì suy diễn thành Sai', () => {
            render(<QuestionReview
                index={0}
                question={{
                    type: 'TRUE_FALSE',
                    questionText: 'Chọn đúng sai',
                    items: [{ id: 'a', statement: 'Mệnh đề A' }],
                }}
                studentAnswer={{ a: false }}
                status="correct"
            />);

            expect(document.querySelector('.tf-item-row.neutral')).toBeTruthy();
            expect(screen.getByText(/Chưa có dữ liệu đáp án/)).toBeDefined();
            expect(screen.queryByText(/Đ\.án: Sai/)).toBeNull();
        });

        it('ưu tiên reviewDetail của server khi snapshot không còn answer key', () => {
            render(<QuestionReview
                index={0}
                question={{
                    type: 'TRUE_FALSE',
                    questionText: 'Chọn đúng sai',
                    items: [{ id: 'a', statement: 'Mệnh đề A' }],
                }}
                studentAnswer={{ a: false }}
                status="correct"
                reviewDetail={{
                    questionId: 'tf-1',
                    type: 'TRUE_FALSE',
                    status: 'correct',
                    isCorrect: true,
                    studentAnswer: { kind: 'mapping', lines: [{ label: 'Mệnh đề A', value: 'Sai' }] },
                    correctAnswer: { kind: 'mapping', lines: [{ label: 'Mệnh đề A', value: 'Sai' }] },
                }}
            />);

            expect(document.querySelector('.tf-item-row.correct')).toBeTruthy();
            expect(document.querySelector('.tf-item-row.wrong')).toBeNull();
            expect(screen.queryByText(/Chưa có dữ liệu đáp án/)).toBeNull();
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
