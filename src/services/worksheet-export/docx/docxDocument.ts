import { AlignmentType, BorderStyle, Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { createWorksheetFileName } from '../fileName';
import { getWorksheetAnswerText } from '../shared/answerFormatter';
import { prepareWorksheetImageAssets } from '../shared/media';
import type { WorksheetExportOptions } from '../types';
import { DOCX_NO_BORDERS } from './docxHelpers';
import { renderDocxQuestion } from './docxQuestionRenderers';
import { createDocxMathChildren } from './docxMath';
import {
    worksheetCenteredParagraph,
    worksheetInfoCell,
    worksheetMathChildren,
    worksheetTextRun,
} from './docxStyle';

function createDocxHeader(opts: WorksheetExportOptions, schoolName: string): any[] {
    return [
        worksheetCenteredParagraph(schoolName.toUpperCase(), true, 40),
        worksheetCenteredParagraph('BÀI KIỂM TRA', true, 40),
        worksheetCenteredParagraph(opts.quiz.title, false, 40),
        worksheetCenteredParagraph(`Lớp ${opts.quiz.classLevel}  •  ${opts.quiz.questions.length} câu  •  ${opts.quiz.timeLimit} phút`, false, 120, '555555'),
        new Table({
            rows: [new TableRow({ children: [
                worksheetInfoCell('Họ và tên: ___________________________', 60),
                worksheetInfoCell('Lớp: ________  Ngày: ________', 40),
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
        worksheetCenteredParagraph('═══ ĐÁP ÁN ═══', true, 200),
        ...opts.quiz.questions.map((question: any, index) => new Paragraph({
            children: [
                worksheetTextRun({ text: `Câu ${index + 1}: `, bold: true }),
                ...worksheetMathChildren(getWorksheetAnswerText(question, true)),
            ],
            spacing: { before: 20, after: 20, line: 320 },
        })),
    ];
}

export async function exportWorksheetDocx(opts: WorksheetExportOptions): Promise<void> {
    const schoolName = opts.schoolName || 'TôHiệuQuiz';
    const imageAssets = await prepareWorksheetImageAssets(opts.quiz);
    const children = [
        ...createDocxHeader(opts, schoolName),
        ...opts.quiz.questions.flatMap((question, index) => renderDocxQuestion(question, index, imageAssets)),
        ...createDocxAnswerKey(opts),
    ];
    const document = new Document({ sections: [{ properties: { page: {
        size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
        margin: {
        top: 1134, bottom: 1134, left: 1134, right: 850, gutter: 0,
        } },
    }, children }] });
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
