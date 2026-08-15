
import { setupUnicodeFont } from '../../../utils/pdfFonts';
import { createWorksheetFileName } from '../fileName';
import { prepareWorksheetImageAssets } from '../shared/media';
import type { WorksheetExportOptions } from '../types';
import { renderPdfAnswerKey } from './pdfAnswerKey';
import { drawPdfBackground, drawPdfHeader } from './pdfLayout';
import { renderPdfQuestion } from './pdfQuestionRenderers';
import type { PdfRenderContext } from './pdfTypes';
import {
    getPdfSvgDiagramKey,
    rasterizeSvgDiagramForPdf,
    type PdfSvgDiagramImage,
} from './pdfSvgDiagram';

function addPdfFooters(doc: PdfRenderContext['doc'], schoolName: string): void {
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
        const { default: jsPDF } = await import('jspdf');
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imageAssets = await prepareWorksheetImageAssets(opts.quiz);
        const svgDiagrams = new Map<string, PdfSvgDiagramImage>();
        await Promise.all(opts.quiz.questions.map(async (question, index) => {
            const svgContent = (question as unknown as Record<string, unknown>).svgContent;
            if (typeof svgContent !== 'string' || !svgContent.trim()) return;
            const rasterized = await rasterizeSvgDiagramForPdf(svgContent);
            if (rasterized) svgDiagrams.set(getPdfSvgDiagramKey(question, index), rasterized);
        }));
        setupUnicodeFont(doc);
        drawPdfBackground(doc, opts.paperStyle);
        const context: PdfRenderContext = {
            doc,
            opts,
            svgDiagrams,
            imageAssets,
            yPos: drawPdfHeader(doc, opts, schoolName),
        };
        opts.quiz.questions.forEach((question, index) => renderPdfQuestion(context, question, index));
        if (opts.answerKey === 'separate') renderPdfAnswerKey(doc, opts.quiz, schoolName);
        addPdfFooters(doc, schoolName);
        doc.save(createWorksheetFileName(opts.quiz.title, 'pdf'));
    } catch (error) {
        console.error('Worksheet export failed:', error);
        throw error;
    }
}
