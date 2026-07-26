import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { createWorksheetFileName } from '../fileName';
import { getWorksheetAnswerText } from '../shared/answerFormatter';
import type { WorksheetExportOptions } from '../types';
import { DOCX_NO_BORDERS } from './docxHelpers';
import { renderDocxQuestion } from './docxQuestionRenderers';
import { createDocxMathChildren } from './docxMath';

function createDocxHeader(opts: WorksheetExportOptions, schoolName: string): any[] {
    return [
        centeredText(schoolName.toUpperCase(), 28, true, 40),
        centeredText('BÀI KIỂM TRÀ', 32, true, 40),
        centeredText(opts.quiz.title, 28, false, 40),
        centeredText(`Lớp ${opts.quiz.classLevel}  •  ${opts.quiz.questions.length} câu  •  ${opts.quiz.timeLimit} phút`, 24, false, 120, '555555'),
        new Table({
            rows: [new TableRow({ children: [
                infoCell('Họ và tên: ___________________________', 60),
                infoCell('Lớp: ________  Ngày: ________', 40),
            ] })],
            width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        new Paragraph({ text: '', spacing: { after: 120 } }),
    ];
}

function createDocxAnswerKey(opts: WorksheetExportOptions): any[] {
    if (opts.answerKey !== 'separate') return [];
    return [
        new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }),
        centeredText('═══ ĐÁP ÁN ═══', 26, true, 200),
        ...opts.quiz.questions.map((question: any, index) => new Paragraph({
            children: [
                new TextRun({ text: `Câu ${index + 1}: `, bold: true, size: 28 }),
                ...createDocxMathChildren(getWorksheetAnswerText(question, true), { size: 28 }),
            ],
            spacing: { before: 20, after: 20, line: 320 },
        })),
    ];
}

export async function exportWorksheetDocx(opts: WorksheetExportOptions): Promise<void> {
    const schoolName = opts.schoolName || 'TôHiệuQuiz';
    const children = [
        ...createDocxHeader(opts, schoolName),
        ...opts.quiz.questions.flatMap((question, index) => renderDocxQuestion(question, index)),
        ...createDocxAnswerKey(opts),
    ];
    const document = new Document({ sections: [{ properties: { page: { margin: {
        top: 1134, bottom: 1134, left: 1701, right: 850,
    } } }, children }] });
    const blob = await Packer.toBlob(document);
    saveAs(blob, createWorksheetFileName(opts.quiz.title, 'docx'));
}

function centeredText(text: string, size: number, bold: boolean, after: number, color?: string): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text, bold, size, color })],
        alignment: AlignmentType.CENTER,
        spacing: { after },
    });
}

function infoCell(text: string, size: number): TableCell {
    return new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, size: 28 })] })],
        width: { size, type: WidthType.PERCENTAGE },
        borders: { ...DOCX_NO_BORDERS, bottom: { style: BorderStyle.NONE } },
    });
}
