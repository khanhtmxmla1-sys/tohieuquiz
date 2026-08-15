import { FONT_NAME } from '../../../../utils/pdfFonts';
import { buildWorksheetMatchingLayout } from '../../shared/matchingLayout';
import { normalizeWorksheetMath } from '../../shared/mathNormalizer';
import { ensurePdfSpace } from '../pdfLayout';
import { PDF_MARGIN, type PdfRenderContext, setPdfFont } from '../pdfTypes';

export function renderPdfMatching(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const layout = buildWorksheetMatchingLayout(question);
    ensurePdfSpace(ctx, layout.rows.length * 8 + 12);
    const columnWidth = (contentWidth - 20) / 2;
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(9);
    doc.text('Cột A', PDF_MARGIN + 2, ctx.yPos);
    doc.text('Cột B', PDF_MARGIN + columnWidth + 22, ctx.yPos);
    ctx.yPos += 5;
    setPdfFont(doc, FONT_NAME, 'normal');
    layout.rows.forEach((row) => {
        ensurePdfSpace(ctx, 8);
        doc.text(`${row.leftLabel}. ${normalizeWorksheetMath(row.left)}`, PDF_MARGIN + 2, ctx.yPos);
        doc.text(`${row.rightLabel}. ${normalizeWorksheetMath(row.right)}`, PDF_MARGIN + columnWidth + 22, ctx.yPos);
        ctx.yPos += 7;
    });
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Kết quả nối: ${layout.rows.map((row) => `${row.leftLabel}.__`).join('  ')}`, PDF_MARGIN + 2, ctx.yPos);
    doc.setTextColor(0, 0, 0);
    ctx.yPos += 7;
}

export function renderPdfDragDrop(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const bank = [...(question.blanks || []), ...(question.distractors || [])]
        .map((item: unknown) => typeof item === 'string'
            ? item
            : (item && typeof item === 'object' && 'content' in item
                ? String((item as { content?: unknown }).content ?? '')
                : String(item ?? '')))
        .sort(() => Math.random() - 0.5);
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
