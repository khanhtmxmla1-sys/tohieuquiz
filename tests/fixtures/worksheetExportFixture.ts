import { QuestionType, type Quiz } from '../../src/types';

export const worksheetQuestionTypeLabels = [
    'Trắc nghiệm', 'Đúng/Sai', 'Tự luận', 'Nối cột', 'Chọn nhiều',
    'Điền khuyết', 'Sắp xếp', 'Hình ảnh', 'Điền dropdown', 'Gạch chân',
    'Phân loại', 'Ghép chữ', 'Câu đố', 'Sửa lỗi', 'GEOMETRY',
];

export function createWorksheetQuiz(): Quiz {
    const questions: any[] = [
        { id: 'q1', type: QuestionType.MCQ, question: 'Tính $1 + 1$', options: ['1', '2', '3', '4'], correctAnswer: 'B' },
        { id: 'q2', type: QuestionType.TRUE_FALSE, mainQuestion: 'Chọn đúng hoặc sai', items: [{ id: 'i1', statement: 'Hà Nội là thủ đô Việt Nam', isCorrect: true }] },
        { id: 'q3', type: QuestionType.SHORT_ANSWER, question: 'Viết kết quả của \\frac{1}{2} + \\frac{1}{4}', correctAnswer: '\\frac{3}{4}' },
        { id: 'q4', type: QuestionType.MATCHING, question: 'Nối phép tính với kết quả', pairs: [{ left: '2 + 2', right: '4' }] },
        { id: 'q5', type: QuestionType.MULTIPLE_SELECT, question: 'Chọn số chẵn', options: ['1', '2', '3', '4'], correctAnswers: ['B', 'D'] },
        { id: 'q6', type: QuestionType.DRAG_DROP, question: 'Điền từ', text: 'Bầu trời màu [xanh].', blanks: ['xanh'], distractors: ['đỏ'] },
        { id: 'q7', type: QuestionType.ORDERING, question: 'Sắp xếp câu', items: ['Câu hai', 'Câu một'], correctOrder: [1, 0] },
        { id: 'q8', type: QuestionType.IMAGE_QUESTION, question: 'Quan sát hình', image: 'data:image/png;base64,AA==', options: ['A', 'B'], correctAnswer: 'A' },
        { id: 'q9', type: QuestionType.DROPDOWN, question: 'Chọn từ phù hợp', text: 'Em ___ học.', blanks: [{ id: 'b1', options: ['đi', 'ăn'], correctAnswer: 'đi' }] },
        { id: 'q10', type: QuestionType.UNDERLINE, question: 'Gạch chân danh từ', sentence: 'Lan yêu trường học', words: ['Lan', 'yêu', 'trường học'], correctWordIndexes: [0, 2] },
        { id: 'q11', type: QuestionType.CATEGORIZATION, question: 'Phân loại từ', categories: [{ id: 'c1', name: 'Danh từ' }], items: [{ id: 'x1', content: 'học sinh', categoryId: 'c1' }] },
        { id: 'q12', type: QuestionType.WORD_SCRAMBLE, question: 'Ghép chữ thành từ', letters: ['T', 'O', 'Á', 'N'], correctWord: 'TOÁN' },
        { id: 'q13', type: QuestionType.RIDDLE, question: 'Giải câu đố', riddleLines: ['Có sắc là quả'], correctAnswer: 'cam', answerType: 'original', answerLabel: 'Đáp án' },
        { id: 'q14', type: QuestionType.ERROR_CORRECTION, question: 'Tìm lỗi chính tả', passage: 'Em rất chăm trỉ.', wrongWord: 'trỉ', correctWord: 'chỉ' },
        { id: 'q15', type: QuestionType.GEOMETRY, question: 'Vẽ hình vuông', geometryData: { kind: 'square' }, correctAnswer: 'Hình vuông' },
    ];

    return {
        id: 'worksheet-quiz',
        title: 'Ôn tập Toán: Phân số',
        classLevel: '4',
        timeLimit: 35,
        questions: questions as Quiz['questions'],
        createdAt: '2026-07-19T00:00:00.000Z',
    };
}
