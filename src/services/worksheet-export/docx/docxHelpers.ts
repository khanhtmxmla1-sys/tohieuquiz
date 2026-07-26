import { BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from 'docx';

export const DOCX_NO_BORDERS = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
};

export const DOCX_TABLE_NO_BORDERS = {
    ...DOCX_NO_BORDERS,
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
};

export function createDocxAnswerLine(): Table {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: DOCX_TABLE_NO_BORDERS,
        rows: [new TableRow({
            children: [new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: 'Trả lời: ', size: 28 })],
                    spacing: { before: 20, after: 20 },
                })],
                borders: { ...DOCX_NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 4 } },
                verticalAlign: VerticalAlign.BOTTOM,
            })],
        })],
    });
}
