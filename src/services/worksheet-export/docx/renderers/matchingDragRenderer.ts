import {
    AlignmentType,
    Paragraph,
    Table,
    TableCell,
    TableRow,

    WidthType,
    type ParagraphChild,
} from 'docx';
import { buildWorksheetMatchingLayout } from '../../shared/matchingLayout';
import { worksheetMathChildren, worksheetTextRun } from '../docxStyle';

export function renderDocxMatching(question: any): Table {
    const layout = buildWorksheetMatchingLayout(question);
    const rows = [new TableRow({ children: [
        createHeaderCell('Cột A', 45), createHeaderCell('Nối', 10, true), createHeaderCell('Cột B', 45),
    ] })];
    layout.rows.forEach((row) => rows.push(new TableRow({ children: [
        createMathCell(`${row.leftLabel}. `, row.left),
        createTextCell('___', true),
        createMathCell(`${row.rightLabel}. `, row.right),
    ] })));
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

export function renderDocxDragDrop(question: any): Paragraph[] {
    const bank = [...(question.blanks || []), ...(question.distractors || [])]
        .map(item => typeof item === 'string' ? item : item?.content ?? String(item ?? ''))
        .sort(() => Math.random() - 0.5);
    const text = (question.text || '').replace(/\[([^\]]+)\]/g, '____');
    return [
        new Paragraph({
            children: [
                worksheetTextRun({ text: 'Từ cho sẵn: ', bold: true, size: 28 }),
                ...worksheetMathChildren(bank.join('  /  '), { size: 28, bold: true }),
            ],
            spacing: { line: 320 },
        }),
        new Paragraph({ children: worksheetMathChildren(text, { size: 28 }), spacing: { line: 320 } }),
    ];
}

function createHeaderCell(text: string, width: number, centered = false): TableCell {
    return new TableCell({ children: [new Paragraph({
        children: [worksheetTextRun({ text, bold: true, size: 28 })],
        alignment: centered ? AlignmentType.CENTER : undefined,
        spacing: { line: 280 },
    })], width: { size: width, type: WidthType.PERCENTAGE } });
}

function createTextCell(text: string, centered = false): TableCell {
    return new TableCell({ children: [new Paragraph({
        children: [worksheetTextRun({ text, size: 28 })],
        alignment: centered ? AlignmentType.CENTER : undefined,
        spacing: { line: 280 },
    })] });
}

function createMathCell(prefix: string, content: unknown): TableCell {
    const children: ParagraphChild[] = [
        worksheetTextRun({ text: prefix, size: 28 }),
        ...worksheetMathChildren(content, { size: 28 }),
    ];
    return new TableCell({ children: [new Paragraph({ children, spacing: { line: 280 } })] });
}
