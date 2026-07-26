import { FONT_NAME } from '../../../../utils/pdfFonts';
import { normalizeWorksheetMath } from '../../shared/mathNormalizer';
import { ensurePdfSpace } from '../pdfLayout';
import { PDF_MARGIN, type PdfRenderContext, setPdfFont } from '../pdfTypes';

export function renderPdfWritingLines(ctx: PdfRenderContext): void {
    const doc = ctx.doc;
    const width = doc.internal.pageSize.getWidth();
    ensurePdfSpace(ctx, 18);
    setPdfFont(doc, FONT_NAME, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Trả lời:', PDF_MARGIN, ctx.yPos);
    ctx.yPos += 6;
    for (let index = 0; index < 2; index += 1) {
        doc.setDrawColor(160, 160, 160);
        doc.setLineWidth(0.3);
        doc.line(PDF_MARGIN + 4, ctx.yPos, width - PDF_MARGIN, ctx.yPos);
        ctx.yPos += 6;
    }
    doc.setTextColor(0, 0, 0);
    ctx.yPos += 2;
}

export function renderPdfUnderline(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    ensurePdfSpace(ctx, 14);
    setPdfFont(doc, FONT_NAME, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Câu: ', PDF_MARGIN, ctx.yPos);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(normalizeWorksheetMath(question.sentence || ''), contentWidth - 14);
    doc.text(lines, PDF_MARGIN + 12, ctx.yPos);
    ctx.yPos += lines.length * 5 + 3;
    doc.setTextColor(80, 80, 80);
    doc.text('(Dùng bút gạch chân từ/cụm từ đúng)', PDF_MARGIN + 2, ctx.yPos);
    doc.setTextColor(0, 0, 0);
    ctx.yPos += 6;
}

export function renderPdfErrorCorrection(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    ensurePdfSpace(ctx, 22);
    const lines = doc.splitTextToSize(normalizeWorksheetMath(question.passage || ''), contentWidth);
    doc.text(lines, PDF_MARGIN, ctx.yPos);
    ctx.yPos += lines.length * 5 + 3;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.text('Từ sai: ________________   Từ đúng: ________________', PDF_MARGIN, ctx.yPos);
    doc.setTextColor(0, 0, 0);
    ctx.yPos += 7;
}

export function renderPdfFallback(ctx: PdfRenderContext): void {
    const width = ctx.doc.internal.pageSize.getWidth();
    ensurePdfSpace(ctx, 14);
    for (let index = 0; index < 2; index += 1) {
        ctx.doc.setDrawColor(160, 160, 160);
        ctx.doc.line(PDF_MARGIN + 4, ctx.yPos, width - PDF_MARGIN, ctx.yPos);
        ctx.yPos += 6;
    }
}
