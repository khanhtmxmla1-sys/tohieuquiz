import { Paragraph } from 'docx';
import { createDocxAnswerLine } from '../docxHelpers';
import { worksheetMathChildren, worksheetTextRun } from '../docxStyle';

export function renderDocxDropdown(question: any): Paragraph[] {
    const text = String(question.text || '').replace(/\[\d+\]/g, '___');
    const children = [
        new Paragraph({
            children: worksheetMathChildren(text, { size: 28 }),
            spacing: { before: 40, after: 40, line: 320 },
        }),
    ];
    (question.blanks || []).forEach((blank: any, index: number) => {
        children.push(new Paragraph({
            children: [
                worksheetTextRun({ text: `[${index + 1}]: `, bold: true, size: 28 }),
                ...worksheetMathChildren((blank.options || []).join(' / '), { size: 28 }),
            ],
            spacing: { before: 20, after: 20, line: 320 },
        }));
    });
    return children;
}

export function renderDocxOrdering(question: any): any[] {
    const children: any[] = [];
    (question.items || []).forEach((item: unknown, index: number) => {
        children.push(new Paragraph({
            children: [
                worksheetTextRun({ text: `(${index + 1}) `, bold: true, size: 28 }),
                ...worksheetMathChildren(item, { size: 28 }),
            ],
            spacing: { before: 20, after: 20, line: 320 },
        }));
    });
    children.push(createDocxAnswerLine('Thứ tự đúng: '));
    return children;
}

export function renderDocxCategorization(question: any): Paragraph[] {
    const categories = (question.categories || []).map((category: any) => category.name).join(' | ');
    const children: Paragraph[] = [
        new Paragraph({
            children: [
                worksheetTextRun({ text: 'Các nhóm: ', bold: true, size: 28 }),
                ...worksheetMathChildren(categories, { size: 28 }),
            ],
            spacing: { before: 40, after: 40, line: 320 },
        }),
        new Paragraph({
            children: [worksheetTextRun({ text: 'Các mục cần phân loại:', bold: true, size: 28 })],
            spacing: { before: 20, after: 20, line: 320 },
        }),
    ];
    (question.items || []).forEach((item: any, index: number) => {
        children.push(new Paragraph({
            children: [
                worksheetTextRun({ text: `${index + 1}. `, bold: true, size: 28 }),
                ...worksheetMathChildren(item.content || '', { size: 28 }),
            ],
            spacing: { before: 20, after: 20, line: 320 },
        }));
    });
    return children;
}

export function renderDocxWordScramble(question: any): any[] {
    return [
        new Paragraph({
            children: [
                worksheetTextRun({ text: 'Các chữ: ', bold: true, size: 28 }),
                ...worksheetMathChildren((question.letters || []).join(' - '), { size: 28 }),
            ],
            spacing: { before: 40, after: 40, line: 320 },
        }),
        createDocxAnswerLine('Từ đúng: '),
    ];
}
