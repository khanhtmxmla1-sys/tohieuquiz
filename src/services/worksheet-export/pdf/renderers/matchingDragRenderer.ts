import { FONT_NAME } from '../../../../utils/pdfFonts';
import { normalizeWorksheetMath } from '../../shared/mathNormalizer';
import { ensurePdfSpace } from '../pdfLayout';
import { PDF_MARGIN, type PdfRenderContext, setPdfFont } from '../pdfTypes';

export function renderPdfMatching(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const pairs: any[] = question.pairs || [];
    const right = [...pairs.map(pair => pair.right)].sort(() => Math.random() - 0.5);
    ensurePdfSpace(ctx, pairs.length * 8 + 12);
    const columnWidth = (contentWidth - 20) / 2;
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(9);
    doc.text('Cột A', PDF_MARGIN + 2, ctx.yPos);
    doc.text('Cột B', PDF_MARGIN + columnWidth + 22, ctx.yPos);
    ctx.yPos += 5;
    setPdfFont(doc, FONT_NAME, 'normal');
    pairs.forEach((pair, index) => {
        ensurePdfSpace(ctx, 8);
        doc.text(`${index + 1}. ${normalizeWorksheetMath(pair.left)}`, PDF_MARGIN + 2, ctx.yPos);
        doc.text(`${String.fromCharCode(65 + index)}. ${normalizeWorksheetMath(right[index] || '')}`, PDF_MARGIN + columnWidth + 22, ctx.yPos);
        ctx.yPos += 7;
    });
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Kết quả nối: ${pairs.map((_, index) => `${index + 1}.__`).join('  ')}`, PDF_MARGIN + 2, ctx.yPos);
    doc.setTextColor(0, 0, 0);
    ctx.yPos += 7;
}

export function renderPdfDragDrop(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const bank = [...(question.blanks || []), ...(question.distractors || [])].sort(() => Math.random() - 0.5);
    ensurePdfSpace(ctx, 20);
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(9);
    doc.text('Từ cho sẵn: ', PDF_MARGIN, ctx.yPos);
    setPdfFont(doc, FONT_NAME, 'normal');
    const bankLines = doc.splitTextToSize(bank.join('  /  '), contentWidth - 30);
    doc.text(bankLines, PDF_MARGIN + 25, ctx.yPos);
    ctx.yPos += bankLines.length * 5 + 3;
    const text = normalizeWorksheetMath((question.text || '').replace(/\[([^\]]+)\]/g, '___'));
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, PDF_MARGIN, ctx.yPos);
    ctx.yPos += lines.length * 5 + 4;
}
