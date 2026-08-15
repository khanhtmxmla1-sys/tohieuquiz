import {
    AlignmentType,
    BorderStyle,
    Paragraph,
    TableCell,
    TextRun,
    WidthType,
    type ParagraphChild,
} from 'docx';
import { createDocxMathChildren } from './docxMath';

export const WORKSHEET_DOCX_FONT = 'Times New Roman';
export const WORKSHEET_DOCX_SIZE = 28;

export function worksheetTextRun(options: Record<string, unknown>): TextRun {
    return new TextRun({
        ...options,
        font: WORKSHEET_DOCX_FONT,
        size: WORKSHEET_DOCX_SIZE,
    } as any);
}

export function worksheetMathChildren(
    content: unknown,
    style: Record<string, unknown> = {},
): ParagraphChild[] {
    return createDocxMathChildren(content, {
        ...style,
        font: WORKSHEET_DOCX_FONT,
        size: WORKSHEET_DOCX_SIZE,
    } as any);
}

export function worksheetCenteredParagraph(
    text: string,
    bold: boolean,
    after: number,
    color?: string,
): Paragraph {
    return new Paragraph({
        children: [worksheetTextRun({ text, bold, color })],
        alignment: AlignmentType.CENTER,
        spacing: { after },
    });
}

export function worksheetInfoCell(text: string, width: number): TableCell {
    return new TableCell({
        children: [new Paragraph({ children: [worksheetTextRun({ text })] })],
        width: { size: width, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
        },
    });
}
