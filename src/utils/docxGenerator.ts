import {
    AlignmentType,
    BorderStyle,
    Document,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    type ParagraphChild,
} from 'docx';
import { saveAs } from 'file-saver';
import { QuestionType, type Quiz } from '../types';
import { createDocxMathChildren } from '../services/worksheet-export/docx/docxMath';

const NO_BORDERS = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
};

const mathParagraph = (
    content: unknown,
    options: Record<string, unknown> = {},
): Paragraph => new Paragraph({
    ...options,
    children: createDocxMathChildren(content),
});

const prefixedMathChildren = (
    prefix: string,
    content: unknown,
    prefixOptions: Record<string, unknown> = {},
): ParagraphChild[] => [
    new TextRun({ text: prefix, ...prefixOptions }),
    ...createDocxMathChildren(content),
];

export const generateQuizDocx = async (quiz: Quiz) => {
    const children: any[] = [];

    children.push(new Paragraph({
        children: createDocxMathChildren(quiz.title, { bold: true, size: 34 }),
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
    }));

    children.push(new Paragraph({
        children: [
            new TextRun({ text: 'Chủ đề: ', bold: true, size: 24 }),
            ...createDocxMathChildren(quiz.topic || '', { bold: true, size: 24 }),
            new TextRun({ text: ` - Lớp: ${quiz.classLevel}`, bold: true, size: 24 }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
    }));

    for (let index = 0; index < quiz.questions.length; index++) {
        const question = quiz.questions[index] as any;
        const difficulty = question.difficulty as 1 | 2 | 3 | undefined;
        const difficultyLabel = difficulty ? ` (Mức ${difficulty})` : '';
        const questionText = question.question || question.mainQuestion || '';

        children.push(new Paragraph({
            children: prefixedMathChildren(
                `Câu ${index + 1}${difficultyLabel}: `,
                questionText,
                { bold: true },
            ),
            spacing: { before: 200, after: 100 },
        }));

        if (question.image && !question.image.includes('placehold.co')) {
            try {
                const response = await fetch(question.image);
                const buffer = await (await response.blob()).arrayBuffer();
                children.push(new Paragraph({
                    children: [new ImageRun({
                        data: buffer,
                        transformation: { width: 300, height: 200 },
                        type: 'png',
                    })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                }));
            } catch (error) {
                console.warn('Could not embed image:', error);
            }
        }

        switch (question.type) {
            case QuestionType.MCQ:
            case QuestionType.MULTIPLE_SELECT:
            case QuestionType.IMAGE_QUESTION:
                children.push(createOptionsTable(question.options || []));
                break;

            case QuestionType.TRUE_FALSE:
                children.push(createTrueFalseTable(question.items || []));
                break;

            case QuestionType.MATCHING:
                children.push(createMatchingTable(question.pairs || []));
                break;

            case QuestionType.SHORT_ANSWER:
                children.push(answerLine('Trả lời'));
                break;

            case QuestionType.DRAG_DROP: {
                const words = [...(question.blanks || []), ...(question.distractors || [])]
                    .map((item: any) => typeof item === 'string' ? item : item?.content ?? String(item ?? ''))
                    .sort(() => Math.random() - 0.5);
                children.push(new Paragraph({
                    children: prefixedMathChildren('Từ cho sẵn: ', words.join(' / '), { bold: true }),
                    spacing: { before: 100 },
                }));
                children.push(mathParagraph(
                    String(question.text || '').replace(/\[([^\]]+)\]/g, '____'),
                    { spacing: { before: 100 } },
                ));
                break;
            }

            case QuestionType.DROPDOWN: {
                children.push(mathParagraph(
                    String(question.text || '').replace(/\[\d+\]/g, '____'),
                    { spacing: { before: 100 } },
                ));
                (question.blanks || []).forEach((blank: any, blankIndex: number) => {
                    children.push(new Paragraph({
                        children: prefixedMathChildren(
                            `[${blankIndex + 1}]: `,
                            (blank.options || []).join(' / '),
                            { bold: true },
                        ),
                        spacing: { before: 50 },
                    }));
                });
                break;
            }

            case QuestionType.ORDERING:
                (question.items || []).forEach((item: unknown, itemIndex: number) => {
                    children.push(new Paragraph({
                        children: prefixedMathChildren(`(${itemIndex + 1}) `, item, { bold: true }),
                        spacing: { before: 50 },
                    }));
                });
                children.push(answerLine('Thứ tự đúng'));
                break;

            case QuestionType.UNDERLINE:
                children.push(mathParagraph(question.sentence || '', { spacing: { before: 100 } }));
                break;

            case QuestionType.CATEGORIZATION:
                children.push(new Paragraph({
                    children: prefixedMathChildren(
                        'Các nhóm: ',
                        (question.categories || []).map((category: any) => category.name).join(' | '),
                        { bold: true },
                    ),
                    spacing: { before: 100 },
                }));
                children.push(new Paragraph({
                    children: [new TextRun({ text: 'Các mục cần phân loại:', bold: true })],
                    spacing: { before: 100 },
                }));
                (question.items || []).forEach((item: any, itemIndex: number) => {
                    children.push(new Paragraph({
                        children: prefixedMathChildren(`${itemIndex + 1}. `, item.content),
                        spacing: { before: 50 },
                    }));
                });
                break;

            case QuestionType.WORD_SCRAMBLE:
                children.push(new Paragraph({
                    children: prefixedMathChildren('Các chữ: ', (question.letters || []).join(' - '), { bold: true }),
                    spacing: { before: 100 },
                }));
                children.push(answerLine('Từ đúng'));
                break;

            case QuestionType.RIDDLE:
                (question.riddleLines || []).forEach((line: unknown) => {
                    children.push(mathParagraph(line, { spacing: { before: 50 } }));
                });
                children.push(answerLine(question.answerLabel || 'Trả lời'));
                break;

            case QuestionType.ERROR_CORRECTION:
                children.push(mathParagraph(question.passage || '', { spacing: { before: 100 } }));
                children.push(answerLine('Từ sai và cách sửa'));
                break;

            default:
                children.push(answerLine('Trả lời'));
                break;
        }

        children.push(new Paragraph({ text: '' }));
    }

    const document = new Document({
        sections: [{ properties: {}, children }],
    });
    saveAs(await Packer.toBlob(document), `${quiz.title || 'quiz'}.docx`);
};

const createOptionsTable = (options: unknown[]): Table => {
    const rows: TableRow[] = [];
    for (let index = 0; index < options.length; index += 2) {
        const cells = [createOptionCell(String(options[index] ?? ''), index)];
        cells.push(index + 1 < options.length
            ? createOptionCell(String(options[index + 1] ?? ''), index + 1)
            : new TableCell({ children: [] }));
        rows.push(new TableRow({ children: cells }));
    }
    return new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
    });
};

const createOptionCell = (text: string, index: number): TableCell => {
    const letter = String.fromCharCode(65 + index);
    const cleanText = text.replace(/^[A-Da-d][.)]\s*/, '');
    return new TableCell({
        children: [new Paragraph({
            children: prefixedMathChildren(`${letter}. `, cleanText, { bold: true }),
        })],
        width: { size: 50, type: WidthType.PERCENTAGE },
    });
};

const createTrueFalseTable = (items: any[]): Table => {
    const rows = [new TableRow({ children: [
        tableHeader('Nội dung', 70),
        tableHeader('Đúng', 15, true),
        tableHeader('Sai', 15, true),
    ] })];
    items.forEach((item) => rows.push(new TableRow({ children: [
        new TableCell({ children: [mathParagraph(item.statement || '')] }),
        checkboxCell(),
        checkboxCell(),
    ] })));
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
};

const createMatchingTable = (pairs: any[]): Table => {
    const rows = [new TableRow({ children: [tableHeader('Cột A', 50), tableHeader('Cột B', 50)] })];
    pairs.forEach((pair) => rows.push(new TableRow({ children: [
        new TableCell({ children: [mathParagraph(pair.left || '')] }),
        new TableCell({ children: [mathParagraph(pair.right || '')] }),
    ] })));
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
};

const tableHeader = (text: string, width: number, centered = false): TableCell => new TableCell({
    children: [new Paragraph({
        children: [new TextRun({ text, bold: true })],
        alignment: centered ? AlignmentType.CENTER : undefined,
    })],
    width: { size: width, type: WidthType.PERCENTAGE },
});

const checkboxCell = (): TableCell => new TableCell({
    children: [new Paragraph({
        children: [new TextRun({ text: '□' })],
        alignment: AlignmentType.CENTER,
    })],
});

const answerLine = (label: string): Paragraph => new Paragraph({
    text: `${label}: .................................................................................................`,
    spacing: { before: 100 },
});
