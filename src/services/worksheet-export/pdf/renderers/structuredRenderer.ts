import { FONT_NAME } from '../../../../utils/pdfFonts';
import { normalizeWorksheetMath } from '../../shared/mathNormalizer';
import { ensurePdfSpace } from '../pdfLayout';
import { PDF_MARGIN, type PdfRenderContext, setPdfFont } from '../pdfTypes';

export function renderPdfOrdering(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const items: string[] = question.items || [];
    ensurePdfSpace(ctx, items.length * 7 + 14);
    setPdfFont(doc, FONT_NAME, 'normal');
    doc.setFontSize(9);
    doc.text('Sắp xếp các ý sau theo thứ tự đúng:', PDF_MARGIN, ctx.yPos);
    ctx.yPos += 5;
    items.forEach((item, index) => {
        ensurePdfSpace(ctx, 8);
        doc.rect(PDF_MARGIN, ctx.yPos - 3.5, 5, 5);
        const lines = doc.splitTextToSize(`${index + 1}. ${normalizeWorksheetMath(item)}`, contentWidth - 10);
        doc.text(lines, PDF_MARGIN + 8, ctx.yPos);
        ctx.yPos += Math.max(lines.length * 5, 7) + 1;
    });
    ctx.yPos += 3;
}

export function renderPdfCategorization(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const categories: any[] = question.categories || [];
    const items: any[] = question.items || [];
    ensurePdfSpace(ctx, 20);
    const categoryWidth = contentWidth / Math.max(categories.length, 1);
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(9);
    categories.forEach((category, index) => {
        const x = PDF_MARGIN + index * categoryWidth;
        doc.setFillColor(230, 230, 230);
        doc.rect(x, ctx.yPos - 4, categoryWidth - 2, 6, 'F');
        doc.text(category.name, x + 2, ctx.yPos);
    });
    ctx.yPos += 8;
    const rows = Math.ceil(items.length / categories.length);
    setPdfFont(doc, FONT_NAME, 'normal');
    for (let row = 0; row < rows + 1; row += 1) {
        ensurePdfSpace(ctx, 8);
        categories.forEach((_, index) => {
            const x = PDF_MARGIN + index * categoryWidth;
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.2);
            doc.line(x + 2, ctx.yPos, x + categoryWidth - 4, ctx.yPos);
        });
        ctx.yPos += 7;
    }
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const bank = items.map(item => item.content).sort(() => Math.random() - 0.5).join('  |  ');
    const lines = doc.splitTextToSize(`Từ để phân loại: ${bank}`, contentWidth);
    doc.text(lines, PDF_MARGIN, ctx.yPos);
    doc.setTextColor(0, 0, 0);
    ctx.yPos += lines.length * 5 + 3;
}

export function renderPdfWordScramble(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    ensurePdfSpace(ctx, 16);
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(11);
    let x = PDF_MARGIN + 2;
    (question.letters || []).forEach((letter: string) => {
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.4);
        doc.rect(x, ctx.yPos - 5, 8, 9);
        doc.text(letter, x + 4, ctx.yPos, { align: 'center' });
        x += 11;
    });
    ctx.yPos += 8;
    setPdfFont(doc, FONT_NAME, 'normal');
    doc.setFontSize(9);
    doc.text('Từ đúng: _ _ _ _ _ _ _ _ _ _ _', PDF_MARGIN, ctx.yPos);
    ctx.yPos += 7;
}
