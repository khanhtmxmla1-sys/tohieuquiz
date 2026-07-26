import {
    AlignmentType,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    type ParagraphChild,
} from 'docx';
import { createDocxMathChildren } from '../docxMath';

export function renderDocxMatching(question: any): Table {
    const pairs: any[] = question.pairs || [];
    const right = [...pairs.map(pair => pair.right)].sort(() => Math.random() - 0.5);
    const rows = [new TableRow({ children: [
        createHeaderCell('Cột A', 45), createHeaderCell('Nối', 10, true), createHeaderCell('Cột B', 45),
    ] })];
    pairs.forEach((pair, index) => rows.push(new TableRow({ children: [
        createMathCell(`${index + 1}. `, pair.left),
        createTextCell('___', true),
        createMathCell(`${String.fromCharCode(65 + index)}. `, right[index] || ''),
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
                new TextRun({ text: 'Từ cho sẵn: ', bold: true, size: 28 }),
                ...createDocxMathChildren(bank.join('  /  '), { size: 28, bold: true }),
            ],
            spacing: { line: 320 },
        }),
        new Paragraph({ children: createDocxMathChildren(text, { size: 28 }), spacing: { line: 320 } }),
    ];
}

function createHeaderCell(text: string, width: number, centered = false): TableCell {
    return new TableCell({ children: [new Paragraph({
        children: [new TextRun({ text, bold: true, size: 28 })],
        alignment: centered ? AlignmentType.CENTER : undefined,
        spacing: { line: 280 },
    })], width: { size: width, type: WidthType.PERCENTAGE } });
}

function createTextCell(text: string, centered = false): TableCell {
    return new TableCell({ children: [new Paragraph({
        children: [new TextRun({ text, size: 28 })],
        alignment: centered ? AlignmentType.CENTER : undefined,
        spacing: { line: 280 },
    })] });
}

function createMathCell(prefix: string, content: unknown): TableCell {
    const children: ParagraphChild[] = [
        new TextRun({ text: prefix, size: 28 }),
        ...createDocxMathChildren(content, { size: 28 }),
    ];
    return new TableCell({ children: [new Paragraph({ children, spacing: { line: 280 } })] });
}
