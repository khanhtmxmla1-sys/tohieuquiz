import type jsPDF from 'jspdf';
import { FONT_NAME, setupUnicodeFont } from '../../../utils/pdfFonts';
import type { WorksheetExportOptions, WorksheetPaperStyle } from '../types';
import { PDF_GRID_SIZE, PDF_MARGIN, PDF_WIDE_LINE_SPACING, type PdfRenderContext, setPdfFont } from './pdfTypes';

export function drawPdfBackground(doc: jsPDF, style: WorksheetPaperStyle): void {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.15);
    if (style === 'grid-5mm') {
        for (let x = 0; x <= width; x += PDF_GRID_SIZE) doc.line(x, 0, x, height);
        for (let y = 0; y <= height; y += PDF_GRID_SIZE) doc.line(0, y, width, y);
    } else if (style === 'lined-wide') {
        for (let y = PDF_MARGIN + 40; y <= height - PDF_MARGIN; y += PDF_WIDE_LINE_SPACING) {
            doc.line(PDF_MARGIN, y, width - PDF_MARGIN, y);
        }
    }
}

export function drawPdfHeader(doc: jsPDF, opts: WorksheetExportOptions, schoolName: string): number {
    const width = doc.internal.pageSize.getWidth();
    let y = PDF_MARGIN;
    setupUnicodeFont(doc);
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(schoolName.toUpperCase(), width / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(14);
    doc.text('BÀI KIỂM TRA', width / 2, y, { align: 'center' });
    y += 6;
    setPdfFont(doc, FONT_NAME, 'normal');
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(opts.quiz.title, width - PDF_MARGIN * 2);
    doc.text(titleLines, width / 2, y, { align: 'center' });
    y += titleLines.length * 5 + 3;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Lớp ${opts.quiz.classLevel}  •  ${opts.quiz.questions.length} câu  •  ${opts.quiz.timeLimit} phút`, width / 2, y, { align: 'center' });
    y += 6;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text('Họ và tên: ___________________________', PDF_MARGIN, y);
    doc.text('Lớp: ________  Ngày: ________', width / 2 + 5, y);
    y += 7;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(PDF_MARGIN, y, width - PDF_MARGIN, y);
    return y + 5;
}

export function addPdfPage(doc: jsPDF, opts: WorksheetExportOptions): number {
    doc.addPage();
    drawPdfBackground(doc, opts.paperStyle);
    return PDF_MARGIN + 5;
}

export function ensurePdfSpace(ctx: PdfRenderContext, needed = 20): void {
    const height = ctx.doc.internal.pageSize.getHeight();
    if (ctx.yPos + needed > height - PDF_MARGIN) ctx.yPos = addPdfPage(ctx.doc, ctx.opts);
}
