import type jsPDF from 'jspdf';
import type { WorksheetExportOptions } from '../types';

export const PDF_MARGIN = 15;
export const PDF_GRID_SIZE = 5;
export const PDF_WIDE_LINE_SPACING = 8;

export interface PdfRenderContext {
    doc: jsPDF;
    opts: WorksheetExportOptions;
    yPos: number;
}

export function setPdfFont(doc: jsPDF, font: string, style: string): void {
    try {
        doc.setFont(font, style);
    } catch {
        doc.setFont('helvetica', style);
    }
}
