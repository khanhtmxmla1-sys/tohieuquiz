import { Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { DOCX_NO_BORDERS, DOCX_TABLE_NO_BORDERS } from '../docxHelpers';
import { createDocxMathChildren } from '../docxMath';

export function renderDocxChoices(question: any): Table[] {
    const letters = ['A', 'B', 'C', 'D'];
    const cells = (question.options || []).map((option: string, index: number) => new TableCell({
        children: [new Paragraph({
            children: [
                new TextRun({ text: `${letters[index]}. `, bold: true, size: 28 }),
                ...createDocxMathChildren(option.replace(/^[A-Da-d][.)]\s*/, ''), { size: 28 }),
            ],
            spacing: { after: 20, line: 320 },
        })],
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: DOCX_NO_BORDERS,
    }));
    const tables: Table[] = [];
    for (let index = 0; index < cells.length; index += 2) {
        const rowCells = [cells[index]];
        if (cells[index + 1]) rowCells.push(cells[index + 1]);
        tables.push(new Table({
            rows: [new TableRow({ children: rowCells })],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: DOCX_TABLE_NO_BORDERS,
        }));
    }
    return tables;
}
