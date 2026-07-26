import { FONT_NAME } from '../../../../utils/pdfFonts';
import { normalizeWorksheetMath } from '../../shared/mathNormalizer';
import { ensurePdfSpace } from '../pdfLayout';
import { PDF_MARGIN, type PdfRenderContext, setPdfFont } from '../pdfTypes';

export function renderPdfTrueFalse(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const width = doc.internal.pageSize.getWidth();
    const contentWidth = width - PDF_MARGIN * 2;
    const items: any[] = question.items || [];
    ensurePdfSpace(ctx, items.length * 8 + 10);
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(9);
    doc.text('Nội dung', PDF_MARGIN + 2, ctx.yPos);
    doc.text('Đ', width - PDF_MARGIN - 14, ctx.yPos, { align: 'center' });
    doc.text('S', width - PDF_MARGIN - 6, ctx.yPos, { align: 'center' });
    ctx.yPos += 4;
    doc.setLineWidth(0.3);
    doc.line(PDF_MARGIN, ctx.yPos, width - PDF_MARGIN, ctx.yPos);
    ctx.yPos += 4;
    setPdfFont(doc, FONT_NAME, 'normal');
    items.forEach(item => {
        ensurePdfSpace(ctx, 10);
        const lines = doc.splitTextToSize(normalizeWorksheetMath(item.statement || ''), contentWidth - 22);
        doc.text(lines, PDF_MARGIN + 2, ctx.yPos);
        doc.rect(width - PDF_MARGIN - 16, ctx.yPos - 3.5, 4, 4);
        doc.rect(width - PDF_MARGIN - 8, ctx.yPos - 3.5, 4, 4);
        ctx.yPos += Math.max(lines.length * 5, 6) + 2;
    });
    ctx.yPos += 2;
}
