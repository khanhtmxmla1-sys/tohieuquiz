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
