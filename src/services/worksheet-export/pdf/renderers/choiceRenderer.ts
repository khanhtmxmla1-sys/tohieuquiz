import { FONT_NAME } from '../../../../utils/pdfFonts';
import { normalizeWorksheetMath } from '../../shared/mathNormalizer';
import { ensurePdfSpace } from '../pdfLayout';
import { PDF_MARGIN, type PdfRenderContext, setPdfFont } from '../pdfTypes';

export function renderPdfChoices(ctx: PdfRenderContext, question: any): void {
    const doc = ctx.doc;
    const width = doc.internal.pageSize.getWidth();
    const contentWidth = width - PDF_MARGIN * 2;
    const options: string[] = question.options || [];
    const letters = ['A', 'B', 'C', 'D'];
    const columns = options.length <= 2 ? 1 : 2;
    const columnWidth = contentWidth / columns;
    options.forEach((option, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = PDF_MARGIN + column * columnWidth;
        const y = ctx.yPos + row * 7;
        ensurePdfSpace(ctx, 10);
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.4);
        doc.rect(x, y - 3.5, 4, 4);
        setPdfFont(doc, FONT_NAME, 'bold');
        doc.setFontSize(9);
        doc.text(`${letters[index]}.`, x + 6, y);
        setPdfFont(doc, FONT_NAME, 'normal');
        const clean = normalizeWorksheetMath(option.replace(/^[A-Da-d][.)]\s*/, ''));
        const lines = doc.splitTextToSize(clean, columnWidth - 14);
        doc.text(lines[0] || '', x + 14, y);
    });
    ctx.yPos += Math.ceil(options.length / columns) * 7 + 4;
}
