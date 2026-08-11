import { describe, expect, it } from 'vitest';
import { Document, Packer, Paragraph } from 'docx';
import writeExcelFile from 'write-excel-file/universal';
import { QuestionType } from '../src/types';
import {
    importQuestionSpreadsheet,
    parseQuestionCsvText,
    parseSpreadsheetRows,
} from '../src/features/manual-quiz-workspace/import/spreadsheetQuestionImporter';
import {
    importQuestionDocx,
    parseDocxQuestionText,
} from '../src/features/manual-quiz-workspace/import/docxQuestionImporter';
import {
    QUESTION_JSON_EXAMPLE,
    parseQuestionJsonText,
} from '../src/features/manual-quiz-workspace/import/jsonQuestionImporter';
import canonicalPromptFixture from '../docs/prompts/ToHieuQuiz_System_Prompt_v4.1_Canonical_Fixture.json';

const officialRows = [
    {
        type: 'MCQ',
        question: '2 + 3 bằng bao nhiêu?',
        optionA: '4',
        optionB: '5',
        optionC: '6',
        optionD: '7',
        correctAnswer: 'B',
        difficulty: '1',
        points: '1.5',
        explanation: 'Hai cộng ba bằng năm.',
        subject: 'toan',
    },
    {
        type: 'SHORT_ANSWER',
        question: 'Thủ đô Việt Nam là gì?',
        correctAnswer: '',
        difficulty: '2',
        points: '1',
        subject: 'lich-su-dia-ly',
    },
    {
        type: 'MCQ',
        question: '',
        optionA: 'A',
        optionB: 'B',
        correctAnswer: 'A',
    },
];

describe('spreadsheet question importer', () => {
    it('maps official rows into accepted, needsReview and rejected groups', () => {
        const result = parseSpreadsheetRows(officialRows);
        expect(result.accepted).toHaveLength(1);
        expect(result.needsReview).toHaveLength(1);
        expect(result.rejected).toHaveLength(1);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            type: QuestionType.MCQ,
            question: '2 + 3 bằng bao nhiêu?',
            options: ['4', '5', '6', '7'],
            correctAnswer: 'B',
            difficulty: 1,
            points: 1.5,
            explanation: 'Hai cộng ba bằng năm.',
            subject: 'toan',
        }));
        expect(result.needsReview[0].issues).toContain('Thiếu đáp án đúng.');
        expect(result.rejected[0].issues).toContain('Thiếu nội dung câu hỏi.');
    });

    it('supports Vietnamese CSV headers and reports the source row', () => {
        const csv = [
            'loai,cau_hoi,dap_an_a,dap_an_b,dap_an_dung,do_kho,diem,loi_giai,mon',
            'MCQ,"1 + 1 = ?",1,2,B,1,2,"Một cộng một bằng hai.",toan',
            'MCQ,"Câu thiếu đáp án",A,B,,2,1,,toan',
        ].join('\n');
        const result = parseQuestionCsvText(csv);
        expect(result.accepted[0].sourceRow).toBe(2);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({ correctAnswer: 'B' }));
        expect(result.needsReview[0].sourceRow).toBe(3);
    });

    it('imports an XLSX workbook using the same official template', async () => {
        const blob = await writeExcelFile([
            ['type', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'difficulty', 'points'],
            ['MCQ', '3 × 4 = ?', '7', '12', '10', '14', 'B', '1', '1'],
        ]).toBlob();
        const file = new File([blob], 'questions.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const result = await importQuestionSpreadsheet(file);
        expect(result.accepted).toHaveLength(1);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            question: '3 × 4 = ?',
            correctAnswer: 'B',
        }));
    });
});

describe('JSON question importer', () => {
    it('preserves valid questionRichText with alignment, hard breaks, marks and LaTeX', () => {
        const questionRichText = {
            schemaVersion: 1,
            doc: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        attrs: { textAlign: 'left' },
                        content: [{ type: 'text', text: 'Quan sát biểu thức sau.', marks: [{ type: 'bold' }] }],
                    },
                    {
                        type: 'paragraph',
                        attrs: { textAlign: 'center' },
                        content: [{ type: 'text', text: '$24 \\div 6 = ?$' }],
                    },
                    {
                        type: 'paragraph',
                        attrs: { textAlign: 'right' },
                        content: [
                            { type: 'text', text: 'Dòng 1' },
                            { type: 'hardBreak' },
                            { type: 'text', text: 'Dòng 2', marks: [{ type: 'underline' }] },
                        ],
                    },
                ],
            },
        };
        const plainQuestion = 'Quan sát biểu thức sau.\n$24 \\div 6 = ?$\nDòng 1\nDòng 2';
        const result = parseQuestionJsonText(JSON.stringify([{
            question_type: 'SINGLE_CHOICE',
            question: plainQuestion,
            questionRichText,
            options: [
                { id: 'A', text: '2' },
                { id: 'B', text: '4' },
                { id: 'C', text: '6' },
                { id: 'D', text: '8' },
            ],
            correct_answer: 'B',
        }]));

        expect(result.accepted).toHaveLength(1);
        expect(result.needsReview).toHaveLength(0);
        expect((result.accepted[0].question as any).questionRichText).toEqual(questionRichText);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({ question: plainQuestion }));
    });

    it('marks invalid questionRichText for review and keeps the plain question fallback', () => {
        const invalidRichTexts = [
            {
                schemaVersion: 1,
                doc: {
                    type: 'doc',
                    content: [{
                        type: 'paragraph',
                        attrs: { textAlign: 'justify' },
                        content: [{ type: 'text', text: 'Không hỗ trợ justify.' }],
                    }],
                },
            },
            {
                schemaVersion: 1,
                doc: {
                    type: 'doc',
                    content: [{ type: 'image', attrs: { src: 'https://example.com/a.png' } }],
                },
            },
        ];
        const result = parseQuestionJsonText(JSON.stringify(invalidRichTexts.map((questionRichText, index) => ({
            question_type: 'SINGLE_CHOICE',
            question: `Câu fallback ${index + 1}`,
            questionRichText,
            options: ['A1', 'A2', 'A3', 'A4'],
            correct_answer: 'A',
        }))));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(2);
        result.needsReview.forEach((candidate, index) => {
            expect(candidate.issues.some((issue) => issue.includes('questionRichText không hợp lệ'))).toBe(true);
            expect(candidate.question).toEqual(expect.objectContaining({ question: `Câu fallback ${index + 1}` }));
            expect((candidate.question as any).questionRichText).toBeUndefined();
        });
    });
    it('accepts an array and normalizes an MCQ answer from option text to its letter', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                type: 'multiple_choice',
                question: '2 + 3 bằng bao nhiêu?',
                options: ['4', '5', '6', '7'],
                answer: '5',
                difficulty: 2,
                points: 1.5,
            },
        ]));

        expect(result.accepted).toHaveLength(1);
        expect(result.accepted[0]).toEqual(expect.objectContaining({
            sourceRow: 1,
            sourceLabel: 'Câu JSON 1',
        }));
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            type: QuestionType.MCQ,
            question: '2 + 3 bằng bao nhiêu?',
            options: ['4', '5', '6', '7'],
            correctAnswer: 'B',
            difficulty: 2,
            points: 1.5,
        }));
        expect(QUESTION_JSON_EXAMPLE).toContain('"questions"');
    });

    it('accepts a questions wrapper and normalizes short answer, true-false, matching and multiple-select shapes', () => {
        const result = parseQuestionJsonText(JSON.stringify({
            questions: [
                {
                    type: 'short_answer',
                    questionText: 'Thủ đô Việt Nam là gì?',
                    answer: 'Hà Nội',
                },
                {
                    type: 'true_false',
                    question: 'Đánh dấu đúng hoặc sai',
                    items: [
                        { statement: '2 + 2 = 4', answer: true },
                        { statement: '2 + 2 = 5', isCorrect: false },
                    ],
                },
                {
                    type: 'matching',
                    question: 'Nối phép tính với kết quả',
                    pairs: [{ left: '1 + 1', right: '2' }],
                },
                {
                    type: 'multiple_select',
                    question: 'Chọn các số chẵn',
                    options: ['1', '2', '3', '4'],
                    answer: ['2', '4'],
                },
            ],
        }));

        expect(result.accepted).toHaveLength(4);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            type: QuestionType.SHORT_ANSWER,
            question: 'Thủ đô Việt Nam là gì?',
            correctAnswer: 'Hà Nội',
        }));
        expect(result.accepted[1].question).toEqual(expect.objectContaining({
            type: QuestionType.TRUE_FALSE,
            mainQuestion: 'Đánh dấu đúng hoặc sai',
            items: [
                expect.objectContaining({ statement: '2 + 2 = 4', isCorrect: true }),
                expect.objectContaining({ statement: '2 + 2 = 5', isCorrect: false }),
            ],
        }));
        expect(result.accepted[2].question).toEqual(expect.objectContaining({
            type: QuestionType.MATCHING,
            pairs: [{ left: '1 + 1', right: '2' }],
        }));
        expect(result.accepted[3].question).toEqual(expect.objectContaining({
            type: QuestionType.MULTIPLE_SELECT,
            correctAnswers: ['B', 'D'],
        }));
    });

    it('accepts canonical Gem fields for the five existing import types without review', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                id: 'Q001',
                question_type: 'SINGLE_CHOICE',
                difficulty: 'NHAN_BIET',
                points: 0.5,
                question: 'The pen is _____.',
                options: [
                    { id: 'A', text: 'mine' },
                    { id: 'B', text: 'my' },
                    { id: 'C', text: 'me' },
                ],
                correct_answer: 'A',
            },
            {
                id: 'Q002',
                question_type: 'TRUE_FALSE',
                difficulty: 'THONG_HIEU',
                points: 0.5,
                question: 'Chọn Đúng hoặc Sai cho mỗi ý.',
                items: [
                    { id: 'TF1', statement: 'The book is mine.', correct_answer: true },
                    { id: 'TF2', statement: 'The ruler is hers.', correct_answer: false },
                ],
            },
            {
                id: 'Q003',
                question_type: 'SHORT_ANSWER',
                difficulty: 'VAN_DUNG',
                points: 0.5,
                question: 'This is your book. It is _____.',
                accepted_answers: ['yours', 'Yours'],
                case_sensitive: false,
            },
            {
                id: 'Q004',
                question_type: 'MATCHING',
                difficulty: 'THONG_HIEU',
                points: 0.5,
                question: 'Nối hai cột.',
                left_items: [
                    { id: 'L1', text: 'my book' },
                    { id: 'L2', text: 'her doll' },
                ],
                right_items: [
                    { id: 'R1', text: 'hers' },
                    { id: 'R2', text: 'mine' },
                ],
                matches: [
                    { left: 'L1', right: 'R2' },
                    { left: 'L2', right: 'R1' },
                ],
            },
            {
                id: 'Q005',
                question_type: 'MULTIPLE_CHOICE',
                difficulty: 'THONG_HIEU',
                points: 0.5,
                question: 'Chọn tất cả các câu đúng.',
                options: [
                    { id: 'A', text: 'The book is mine.' },
                    { id: 'B', text: 'The ruler is his.' },
                    { id: 'C', text: 'The doll is hers.' },
                    { id: 'D', text: 'The bag is me.' },
                ],
                correct_answers: ['A', 'B', 'C'],
            },
        ]));

        expect(result.needsReview).toHaveLength(0);
        expect(result.rejected).toHaveLength(0);
        expect(result.accepted).toHaveLength(5);
        expect(result.accepted.map((candidate) => candidate.question.type)).toEqual([
            QuestionType.MCQ,
            QuestionType.TRUE_FALSE,
            QuestionType.SHORT_ANSWER,
            QuestionType.MATCHING,
            QuestionType.MULTIPLE_SELECT,
        ]);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            correctAnswer: 'A',
            difficulty: 1,
        }));
        expect(result.accepted[1].question).toEqual(expect.objectContaining({
            mainQuestion: 'Chọn Đúng hoặc Sai cho mỗi ý.',
            difficulty: 2,
            items: [
                expect.objectContaining({ statement: 'The book is mine.', isCorrect: true }),
                expect.objectContaining({ statement: 'The ruler is hers.', isCorrect: false }),
            ],
        }));
        expect(result.accepted[2].question).toEqual(expect.objectContaining({
            correctAnswer: 'yours|Yours',
            difficulty: 3,
        }));
        expect(result.accepted[3].question).toEqual(expect.objectContaining({
            pairs: [
                { left: 'my book', right: 'mine' },
                { left: 'her doll', right: 'hers' },
            ],
        }));
        expect(result.accepted[4].question).toEqual(expect.objectContaining({
            correctAnswers: ['A', 'B', 'C'],
        }));
    });

    it('keeps legacy multiple_choice as MCQ while canonical MULTIPLE_CHOICE means multiple select', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                type: 'multiple_choice',
                question: 'Legacy single choice',
                options: ['A1', 'A2'],
                answer: 'A',
            },
            {
                question_type: 'MULTIPLE_CHOICE',
                question: 'Canonical multi select',
                options: ['A1', 'A2', 'A3'],
                correct_answers: ['A', 'C'],
            },
        ]));

        expect(result.accepted).toHaveLength(2);
        expect(result.accepted[0].question.type).toBe(QuestionType.MCQ);
        expect(result.accepted[1].question.type).toBe(QuestionType.MULTIPLE_SELECT);
    });

    it('normalizes canonical drag-drop, ordering, dropdown and underline questions', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'DRAG_DROP_FILL',
                difficulty: 'THONG_HIEU',
                points: 1,
                question: 'Kéo các từ thích hợp vào chỗ trống.',
                content: 'I have a book. It is {{blank1}}. You have a ruler. It is {{blank2}}.',
                drag_items: [
                    { id: 'D1', text: 'mine' },
                    { id: 'D2', text: 'yours' },
                    { id: 'D3', text: 'hers' },
                ],
                answers: [
                    { blank: 'blank1', item: 'D1' },
                    { blank: 'blank2', item: 'D2' },
                ],
            },
            {
                question_type: 'ORDERING',
                difficulty: 'THONG_HIEU',
                points: 1,
                question: 'Sắp xếp các từ để tạo thành câu đúng.',
                items: [
                    { id: 'O1', text: 'hers' },
                    { id: 'O2', text: 'This' },
                    { id: 'O3', text: 'is' },
                ],
                correct_order: ['O2', 'O3', 'O1'],
            },
            {
                question_type: 'DROPDOWN',
                difficulty: 'THONG_HIEU',
                points: 1,
                question: 'Chọn từ đúng trong mỗi danh sách.',
                content: 'The book is {{select1}}. The ruler is {{select2}}.',
                dropdowns: [
                    { id: 'select1', options: ['mine', 'my'], correct_answer: 'mine' },
                    { id: 'select2', options: ['yours', 'your'], correct_answer: 'yours' },
                ],
            },
            {
                question_type: 'UNDERLINE',
                difficulty: 'NHAN_BIET',
                points: 1,
                question: 'Gạch chân các đại từ sở hữu.',
                content: 'This book is mine and that ruler is yours.',
                selectable_parts: [
                    { id: 'U1', text: 'mine' },
                    { id: 'U2', text: 'ruler' },
                    { id: 'U3', text: 'yours' },
                ],
                correct_answers: ['U1', 'U3'],
            },
        ]));

        expect(result.needsReview).toHaveLength(0);
        expect(result.rejected).toHaveLength(0);
        expect(result.accepted.map((candidate) => candidate.question.type)).toEqual([
            QuestionType.DRAG_DROP,
            QuestionType.ORDERING,
            QuestionType.DROPDOWN,
            QuestionType.UNDERLINE,
        ]);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            text: 'I have a book. It is [blank1]. You have a ruler. It is [blank2].',
            blanks: [
                { id: 'blank1', correctAnswer: 'mine' },
                { id: 'blank2', correctAnswer: 'yours' },
            ],
            distractors: ['hers'],
        }));
        expect(result.accepted[1].question).toEqual(expect.objectContaining({
            items: ['hers', 'This', 'is'],
            correctOrder: [1, 2, 0],
        }));
        expect(result.accepted[2].question).toEqual(expect.objectContaining({
            text: 'The book is [select1]. The ruler is [select2].',
            blanks: [
                { id: 'select1', options: ['mine', 'my'], correctAnswer: 'mine' },
                { id: 'select2', options: ['yours', 'your'], correctAnswer: 'yours' },
            ],
        }));
        expect(result.accepted[3].question).toEqual(expect.objectContaining({
            sentence: 'This book is mine and that ruler is yours.',
            words: ['This', 'book', 'is', 'mine', 'and', 'that', 'ruler', 'is', 'yours.'],
            correctWordIndexes: [3, 8],
        }));
    });
    it('normalizes canonical image, categorization, word assembly and riddle questions', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'IMAGE_QUESTION',
                difficulty: 'NHAN_BIET',
                points: 1,
                image_url: 'https://example.com/book.jpg',
                image_description: 'A child holding a book',
                question: 'The book belongs to Mai. It is _____.',
                options: [
                    { id: 'A', text: 'hers' },
                    { id: 'B', text: 'his' },
                    { id: 'C', text: 'ours' },
                ],
                correct_answer: 'A',
            },
            {
                question_type: 'CATEGORIZATION',
                difficulty: 'THONG_HIEU',
                points: 1,
                question: 'Phân loại các từ.',
                groups: [
                    { id: 'G1', name: 'Tính từ sở hữu' },
                    { id: 'G2', name: 'Đại từ sở hữu' },
                ],
                items: [
                    { id: 'I1', text: 'my' },
                    { id: 'I2', text: 'mine' },
                ],
                answers: [
                    { item: 'I1', group: 'G1' },
                    { item: 'I2', group: 'G2' },
                ],
            },
            {
                question_type: 'WORD_ASSEMBLY',
                difficulty: 'NHAN_BIET',
                points: 1,
                question: 'Ghép các chữ thành từ đúng.',
                parts: [
                    { id: 'W1', text: 'o' },
                    { id: 'W2', text: 'b' },
                    { id: 'W3', text: 'k' },
                    { id: 'W4', text: 'o' },
                ],
                correct_order: ['W2', 'W1', 'W4', 'W3'],
                correct_text: 'book',
            },
            {
                question_type: 'RIDDLE',
                difficulty: 'THONG_HIEU',
                points: 1,
                riddle: 'Thân em nhiều đốt\nRuột trắng áo xanh',
                accepted_answers: ['cây mía', 'mía'],
                hint: 'Một loại cây.',
            },
        ]));

        expect(result.needsReview).toHaveLength(0);
        expect(result.rejected).toHaveLength(0);
        expect(result.accepted.map((candidate) => candidate.question.type)).toEqual([
            QuestionType.IMAGE_QUESTION,
            QuestionType.CATEGORIZATION,
            QuestionType.WORD_SCRAMBLE,
            QuestionType.RIDDLE,
        ]);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            image: 'https://example.com/book.jpg',
            imageAlt: 'A child holding a book',
            correctAnswer: 'A',
        }));
        expect(result.accepted[1].question).toEqual(expect.objectContaining({
            categories: [
                { id: 'G1', name: 'Tính từ sở hữu' },
                { id: 'G2', name: 'Đại từ sở hữu' },
            ],
            items: [
                { id: 'I1', content: 'my', categoryId: 'G1' },
                { id: 'I2', content: 'mine', categoryId: 'G2' },
            ],
        }));
        expect(result.accepted[2].question).toEqual(expect.objectContaining({
            letters: ['o', 'b', 'k', 'o'],
            correctWord: 'book',
        }));
        expect(result.accepted[3].question).toEqual(expect.objectContaining({
            question: 'Em hãy giải câu đố sau.',
            riddleLines: ['Thân em nhiều đốt', 'Ruột trắng áo xanh'],
            correctAnswer: 'cây mía|mía',
            answerType: 'original',
            answerLabel: 'Đáp án',
            hint: 'Một loại cây.',
        }));
    });

    it('requires media for image questions but adapts sentence-style word assembly to ordering', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'IMAGE_QUESTION',
                image_description: 'A child holding a book',
                question: 'The book is _____.',
                options: ['mine', 'yours'],
                correct_answer: 'A',
            },
            {
                question_type: 'WORD_ASSEMBLY',
                question: 'Ghép các từ thành câu.',
                parts: [
                    { id: 'W1', text: 'mine' },
                    { id: 'W2', text: 'This' },
                    { id: 'W3', text: 'is' },
                ],
                correct_order: ['W2', 'W3', 'W1'],
                correct_text: 'This is mine',
            },
        ]));

        expect(result.accepted).toHaveLength(1);
        expect(result.needsReview).toHaveLength(1);
        expect(result.needsReview[0].question.type).toBe(QuestionType.IMAGE_QUESTION);
        expect(result.needsReview[0].issues.join(' ')).toMatch(/ảnh|media/i);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            type: QuestionType.ORDERING,
            items: ['mine', 'This', 'is'],
            correctOrder: [1, 2, 0],
        }));
    });
    it('supports multi-word UNDERLINE parts by mapping each phrase to its contiguous word span', () => {
        const result = parseQuestionJsonText(JSON.stringify([{
            question_type: 'UNDERLINE',
            difficulty: 'VAN_DUNG',
            points: 1,
            question: 'Gạch chân dưới các vế B trong đoạn văn sau.',
            content: 'Cây me tây cao lớn tựa một người khổng lồ. Tán lá xòe rộng như một chiếc ô xanh.',
            selectable_parts: [
                { id: 'U1', text: 'một người khổng lồ' },
                { id: 'U2', text: 'một chiếc ô xanh' },
            ],
            correct_answers: ['U1', 'U2'],
        }]));

        expect(result.needsReview).toHaveLength(0);
        expect(result.accepted).toHaveLength(1);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            type: QuestionType.UNDERLINE,
            correctWordIndexes: [6, 7, 8, 9, 15, 16, 17, 18],
        }));
    });

    it('flags categorization answers that reference missing items or assign one item more than once', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'CATEGORIZATION',
                question: 'Phân loại các từ.',
                groups: [
                    { id: 'G1', name: 'Nhóm 1' },
                    { id: 'G2', name: 'Nhóm 2' },
                ],
                items: [{ id: 'I1', text: 'một' }],
                answers: [
                    { item: 'I1', group: 'G1' },
                    { item: 'I_MISSING', group: 'G2' },
                ],
            },
            {
                question_type: 'CATEGORIZATION',
                question: 'Phân loại các từ.',
                groups: [
                    { id: 'G1', name: 'Nhóm 1' },
                    { id: 'G2', name: 'Nhóm 2' },
                ],
                items: [{ id: 'I1', text: 'một' }],
                answers: [
                    { item: 'I1', group: 'G1' },
                    { item: 'I1', group: 'G2' },
                ],
            },
        ]));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(2);
        result.needsReview.forEach((candidate) => {
            expect(candidate.question.type).toBe(QuestionType.CATEGORIZATION);
            expect(candidate.issues.join(' ')).toMatch(/phân loại|tham chiếu|group|item/i);
        });
    });

    it('requires WORD_ASSEMBLY correct_order and flags correct_text that disagrees with that order', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'WORD_ASSEMBLY',
                question: 'Ghép các chữ thành từ đúng.',
                parts: [
                    { id: 'W1', text: 'c' },
                    { id: 'W2', text: 'a' },
                    { id: 'W3', text: 't' },
                ],
                correct_text: 'cat',
            },
            {
                question_type: 'WORD_ASSEMBLY',
                question: 'Ghép các chữ thành từ đúng.',
                parts: [
                    { id: 'W1', text: 'a' },
                    { id: 'W2', text: 't' },
                    { id: 'W3', text: 'c' },
                ],
                correct_order: ['W3', 'W1', 'W2'],
                correct_text: 'dog',
            },
        ]));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(2);
        expect(result.needsReview[0].issues.join(' ')).toMatch(/correct_order|ghép chữ/i);
        expect(result.needsReview[1].issues.join(' ')).toMatch(/correct_text|khớp|thứ tự/i);
    });

    it('rejects obvious placeholder image URLs instead of treating them as real media', () => {
        const result = parseQuestionJsonText(JSON.stringify([{
            question_type: 'IMAGE_QUESTION',
            image_url: 'https://...',
            image_description: 'Một hình minh họa.',
            question: 'Quan sát hình và chọn đáp án đúng.',
            options: ['A1', 'A2'],
            correct_answer: 'A',
        }]));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(1);
        expect(result.needsReview[0].issues.join(' ')).toMatch(/ảnh|media|url/i);
    });

    it('flags DROPDOWN field leakage while accepting the canonical field ownership shape', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'DROPDOWN',
                question: 'Chọn từ so sánh thích hợp để điền vào câu ca dao sau.\nCông cha {{select1}} núi Thái Sơn\nNghĩa mẹ {{select2}} nước trong nguồn chảy ra.',
                content: 'Công cha {{select1}} núi Thái Sơn\nNghĩa mẹ {{select2}} nước trong nguồn chảy ra.',
                dropdowns: [
                    { id: 'select1', options: ['như', 'tựa'], correct_answer: 'như' },
                    { id: 'select2', options: ['như', 'tựa'], correct_answer: 'như' },
                ],
            },
            {
                question_type: 'DROPDOWN',
                question: 'Chọn từ so sánh thích hợp để điền vào câu ca dao sau.',
                content: 'Công cha {{select1}} núi Thái Sơn\nNghĩa mẹ {{select2}} nước trong nguồn chảy ra.',
                dropdowns: [
                    { id: 'select1', options: ['như', 'tựa'], correct_answer: 'như' },
                    { id: 'select2', options: ['như', 'tựa'], correct_answer: 'như' },
                ],
            },
        ]));

        expect(result.accepted).toHaveLength(1);
        expect(result.needsReview).toHaveLength(1);
        expect(result.needsReview[0].question.type).toBe(QuestionType.DROPDOWN);
        expect(result.needsReview[0].issues.join(' ')).toMatch(/DROPDOWN|question|content|select/i);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            question: 'Chọn từ so sánh thích hợp để điền vào câu ca dao sau.',
            text: 'Công cha [select1] núi Thái Sơn\nNghĩa mẹ [select2] nước trong nguồn chảy ra.',
        }));
    });

    it('flags rich-text leakage and drops the violating rich text from the import candidate', () => {
        const questionRichText = {
            schemaVersion: 1,
            doc: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Chọn từ so sánh thích hợp để điền vào câu ca dao sau.' }],
                    },
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'Công cha {{select1}} núi Thái Sơn' },
                            { type: 'hardBreak' },
                            { type: 'text', text: 'Nghĩa mẹ {{select2}} nước trong nguồn chảy ra.' },
                        ],
                    },
                ],
            },
        };
        const result = parseQuestionJsonText(JSON.stringify([{
            question_type: 'DROPDOWN',
            question: 'Chọn từ so sánh thích hợp để điền vào câu ca dao sau.',
            questionRichText,
            content: 'Công cha {{select1}} núi Thái Sơn\nNghĩa mẹ {{select2}} nước trong nguồn chảy ra.',
            dropdowns: [
                { id: 'select1', options: ['như', 'tựa'], correct_answer: 'như' },
                { id: 'select2', options: ['như', 'tựa'], correct_answer: 'như' },
            ],
        }]));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(1);
        expect(result.needsReview[0].issues.join(' ')).toMatch(/questionRichText|question|content|select/i);
        expect((result.needsReview[0].question as any).questionRichText).toBeUndefined();
    });

    it('flags content-owned payload copied into prompts for drag-drop, underline and riddle', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'DRAG_DROP_FILL',
                question: 'Kéo từ thích hợp. I have a book. It is {{blank1}}.',
                content: 'I have a book. It is {{blank1}}.',
                drag_items: [
                    { id: 'D1', text: 'mine' },
                    { id: 'D2', text: 'yours' },
                ],
                answers: [{ blank: 'blank1', item: 'D1' }],
            },
            {
                question_type: 'UNDERLINE',
                question: 'Gạch chân từ so sánh. Cây cao lớn tựa một người khổng lồ.',
                content: 'Cây cao lớn tựa một người khổng lồ.',
                selectable_parts: [{ id: 'U1', text: 'tựa' }],
                correct_answers: ['U1'],
            },
            {
                question_type: 'RIDDLE',
                question: 'Em hãy giải câu đố sau. Thân em nhiều đốt Ruột trắng áo xanh',
                riddle: 'Thân em nhiều đốt\nRuột trắng áo xanh',
                accepted_answers: ['cây mía'],
            },
        ]));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(3);
        expect(result.needsReview.map((candidate) => candidate.question.type)).toEqual([
            QuestionType.DRAG_DROP,
            QuestionType.UNDERLINE,
            QuestionType.RIDDLE,
        ]);
    });

    it('accepts choice options that occur naturally inside a shared reading passage', () => {
        const question = 'Đọc đoạn văn sau và chọn tất cả các từ chỉ hoạt động, trạng thái được dùng để nhân hóa thiên nhiên. Mặt trời đạp xe qua đỉnh núi. Gió trốn tìm trong kẽ lá. Những chú chim hót líu lo.';
        const questionRichText = {
            schemaVersion: 1,
            doc: {
                type: 'doc',
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: question }],
                }],
            },
        };
        const result = parseQuestionJsonText(JSON.stringify([{
            question_type: 'MULTIPLE_CHOICE',
            question,
            questionRichText,
            options: [
                { id: 'A', text: 'đạp xe' },
                { id: 'B', text: 'trốn tìm' },
                { id: 'C', text: 'hót líu lo' },
            ],
            correct_answers: ['A', 'B'],
        }]));

        expect(result.needsReview).toHaveLength(0);
        expect(result.rejected).toHaveLength(0);
        expect(result.accepted).toHaveLength(1);
        expect((result.accepted[0].question as any).questionRichText).toEqual(questionRichText);
    });

    it('still flags a choice list explicitly copied into the main question', () => {
        const result = parseQuestionJsonText(JSON.stringify([{
            question_type: 'MULTIPLE_CHOICE',
            question: 'Chọn tất cả đáp án đúng.\nA. đạp xe\nB. trốn tìm\nC. hót líu lo',
            options: [
                { id: 'A', text: 'đạp xe' },
                { id: 'B', text: 'trốn tìm' },
                { id: 'C', text: 'hót líu lo' },
            ],
            correct_answers: ['A', 'B'],
        }]));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(1);
        expect(result.needsReview[0].issues.join(' ')).toMatch(/MULTIPLE_CHOICE|options|question/i);
    });

    it('flags structured item payload duplicated into question text', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'TRUE_FALSE',
                question: 'Chọn đúng hoặc sai. Trái Đất quay quanh Mặt Trời. Mặt Trăng là một ngôi sao.',
                items: [
                    { id: 'TF1', statement: 'Trái Đất quay quanh Mặt Trời.', correct_answer: true },
                    { id: 'TF2', statement: 'Mặt Trăng là một ngôi sao.', correct_answer: false },
                ],
            },
            {
                question_type: 'MATCHING',
                question: 'Nối hai cột: thủ đô Việt Nam; thủ đô Nhật Bản; Hà Nội; Tokyo.',
                left_items: [
                    { id: 'L1', text: 'thủ đô Việt Nam' },
                    { id: 'L2', text: 'thủ đô Nhật Bản' },
                ],
                right_items: [
                    { id: 'R1', text: 'Tokyo' },
                    { id: 'R2', text: 'Hà Nội' },
                ],
                matches: [
                    { left: 'L1', right: 'R2' },
                    { left: 'L2', right: 'R1' },
                ],
            },
            {
                question_type: 'ORDERING',
                question: 'Sắp xếp: Thức dậy; Đánh răng; Ăn sáng.',
                items: [
                    { id: 'O1', text: 'Thức dậy' },
                    { id: 'O2', text: 'Đánh răng' },
                    { id: 'O3', text: 'Ăn sáng' },
                ],
                correct_order: ['O1', 'O2', 'O3'],
            },
            {
                question_type: 'CATEGORIZATION',
                question: 'Phân loại: Động vật; Thực vật; con mèo; cây phượng.',
                groups: [
                    { id: 'G1', name: 'Động vật' },
                    { id: 'G2', name: 'Thực vật' },
                ],
                items: [
                    { id: 'I1', text: 'con mèo' },
                    { id: 'I2', text: 'cây phượng' },
                ],
                answers: [
                    { item: 'I1', group: 'G1' },
                    { item: 'I2', group: 'G2' },
                ],
            },
            {
                question_type: 'WORD_ASSEMBLY',
                question: 'Ghép các từ sau thành câu: This; book; is; mine.',
                parts: [
                    { id: 'W1', text: 'book' },
                    { id: 'W2', text: 'mine' },
                    { id: 'W3', text: 'This' },
                    { id: 'W4', text: 'is' },
                ],
                correct_order: ['W3', 'W1', 'W4', 'W2'],
                correct_text: 'This book is mine',
            },
        ]));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(5);
    });

    it('parses the copied canonical JSON example as ready to import', () => {
        const result = parseQuestionJsonText(QUESTION_JSON_EXAMPLE);
        expect(result.accepted).toHaveLength(1);
        expect(result.needsReview).toHaveLength(0);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            type: QuestionType.MCQ,
            correctAnswer: 'B',
        }));
    });

    it('imports the v4.1 canonical prompt fixture with all 13 question types', () => {
        const result = parseQuestionJsonText(JSON.stringify(canonicalPromptFixture));

        expect(result.accepted).toHaveLength(13);
        expect(result.needsReview).toHaveLength(0);
        expect(result.rejected).toHaveLength(0);
        expect(new Set(result.accepted.map(item => item.question.type)).size).toBe(13);
    });

    it('flags conflicting type aliases and broken canonical references for review', () => {
        const result = parseQuestionJsonText(JSON.stringify([
            {
                question_type: 'MULTIPLE_CHOICE',
                type: 'multiple_choice',
                question: 'Conflicting aliases',
                options: ['A', 'B', 'C'],
                correct_answers: ['A', 'C'],
            },
            {
                question_type: 'ORDERING',
                question: 'Broken ordering',
                items: [
                    { id: 'O1', text: 'one' },
                    { id: 'O2', text: 'two' },
                ],
                correct_order: ['O1', 'MISSING'],
            },
            {
                question_type: 'DRAG_DROP_FILL',
                question: 'Broken drag drop',
                content: '{{blank1}}',
                drag_items: [{ id: 'D1', text: 'mine' }],
                answers: [{ blank: 'blank1', item: 'MISSING' }],
            },
            {
                question_type: 'CATEGORIZATION',
                question: 'Broken categorization',
                groups: [
                    { id: 'G1', name: 'A' },
                    { id: 'G2', name: 'B' },
                ],
                items: [{ id: 'I1', text: 'item' }],
                answers: [{ item: 'I1', group: 'MISSING' }],
            },
        ]));

        expect(result.accepted).toHaveLength(0);
        expect(result.needsReview).toHaveLength(4);
        expect(result.needsReview[0].question.type).toBe(QuestionType.MULTIPLE_SELECT);
        expect(result.needsReview[0].issues.join(' ')).toMatch(/question_type.*type|khác nhau/i);
    });
    it('rejects invalid syntax and invalid top-level JSON with readable errors', () => {
        expect(() => parseQuestionJsonText('{bad json')).toThrow(/JSON không hợp lệ/i);
        expect(() => parseQuestionJsonText(JSON.stringify({ foo: [] }))).toThrow(/questions/i);
    });
});

describe('DOCX question importer', () => {
    const docText = [
        'Câu 1: 5 + 5 bằng bao nhiêu?',
        'A. 8',
        'B. 9',
        'C. 10',
        'D. 11',
        'Đáp án: C',
        'Giải thích: Năm cộng năm bằng mười.',
        '',
        'Câu 2: Từ nào chỉ hoạt động?',
        'A. xanh',
        'B. chạy',
        'C. đẹp',
        'Đáp án:',
    ].join('\n');

    it('parses confident blocks and keeps uncertain blocks for review', () => {
        const result = parseDocxQuestionText(docText);
        expect(result.accepted).toHaveLength(1);
        expect(result.needsReview).toHaveLength(1);
        expect(result.accepted[0].question).toEqual(expect.objectContaining({
            type: QuestionType.MCQ,
            correctAnswer: 'C',
            explanation: 'Năm cộng năm bằng mười.',
        }));
        expect(result.needsReview[0].issues).toContain('Thiếu đáp án đúng.');
    });

    it('extracts raw text from a DOCX file before parsing', async () => {
        const document = new Document({
            sections: [{ children: docText.split('\n').map((line) => new Paragraph(line)) }],
        });
        const buffer = await Packer.toBuffer(document);
        const file = new File([buffer], 'questions.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        const result = await importQuestionDocx(file);
        expect(result.accepted).toHaveLength(1);
        expect(result.needsReview).toHaveLength(1);
    });
});
