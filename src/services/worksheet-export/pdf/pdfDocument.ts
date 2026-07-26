import jsPDF from 'jspdf';
import { setupUnicodeFont } from '../../../utils/pdfFonts';
import { createWorksheetFileName } from '../fileName';
import type { WorksheetExportOptions } from '../types';
import { renderPdfAnswerKey } from './pdfAnswerKey';
import { drawPdfBackground, drawPdfHeader } from './pdfLayout';
import { renderPdfQuestion } from './pdfQuestionRenderers';
import type { PdfRenderContext } from './pdfTypes';

function addPdfFooters(doc: jsPDF, schoolName: string): void {
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Trang ${page} / ${totalPages}  —  ${schoolName}  —  TôHiệuQuiz`,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 7,
            { align: 'center' },
        );
    }
}

export async function exportWorksheetPdf(opts: WorksheetExportOptions): Promise<void> {
    const schoolName = opts.schoolName || 'TôHiệuQuiz';
    try {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        setupUnicodeFont(doc);
        drawPdfBackground(doc, opts.paperStyle);
        const context: PdfRenderContext = { doc, opts, yPos: drawPdfHeader(doc, opts, schoolName) };
        opts.quiz.questions.forEach((question, index) => renderPdfQuestion(context, question, index));
        addPdfFooters(doc, schoolName);
        if (opts.answerKey === 'separate') renderPdfAnswerKey(doc, opts.quiz, schoolName);
        doc.save(createWorksheetFileName(opts.quiz.title, 'pdf'));
    } catch (error) {
        console.error('Worksheet export failed:', error);
        throw error;
    }
}
