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
    const rows = Math.ceil(options.length / columns);

    for (let row = 0; row < rows; row += 1) {
        const indexes = Array.from({ length: columns }, (_, column) => row * columns + column)
            .filter(index => index < options.length);
        const prepared = indexes.map((index) => {
            const clean = normalizeWorksheetMath(options[index].replace(/^[A-Da-d][.)]\s*/, ''));
            return {
                index,
                lines: doc.splitTextToSize(clean, columnWidth - 14),
            };
        });
        const rowHeight = Math.max(7, ...prepared.map(item => item.lines.length * 5));
        ensurePdfSpace(ctx, rowHeight + 3);
        const y = ctx.yPos;

        prepared.forEach(({ index, lines }) => {
            const column = index % columns;
            const x = PDF_MARGIN + column * columnWidth;
            doc.setDrawColor(60, 60, 60);
            doc.setLineWidth(0.4);
            doc.rect(x, y - 3.5, 4, 4);
            setPdfFont(doc, FONT_NAME, 'bold');
            doc.setFontSize(9);
            doc.text(`${letters[index]}.`, x + 6, y);
            setPdfFont(doc, FONT_NAME, 'normal');
            doc.text(lines, x + 14, y);
        });
        ctx.yPos += rowHeight + 2;
    }
    ctx.yPos += 2;
}
