import { AlignmentType, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { createDocxMathChildren } from '../docxMath';

function headerCell(text: string, width: number, centered = false): TableCell {
    return new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 28 })],
            alignment: centered ? AlignmentType.CENTER : undefined,
            spacing: { line: 280 },
        })],
        width: { size: width, type: WidthType.PERCENTAGE },
    });
}

export function renderDocxTrueFalse(question: any): Table {
    const rows = [new TableRow({ children: [
        headerCell('Nội dung', 70), headerCell('Đ', 15, true), headerCell('S', 15, true),
    ] })];
    (question.items || []).forEach((item: any) => rows.push(new TableRow({ children: [
        new TableCell({ children: [new Paragraph({
            children: createDocxMathChildren(item.statement || '', { size: 28 }),
            spacing: { line: 280 },
        })] }),
        ...['Đ', 'S'].map(() => new TableCell({ children: [new Paragraph({
            children: [new TextRun({ text: '□', size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { line: 280 },
        })] })),
    ] })));
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}
