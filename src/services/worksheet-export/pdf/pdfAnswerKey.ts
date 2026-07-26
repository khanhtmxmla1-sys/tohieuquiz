import type jsPDF from 'jspdf';
import type { Quiz } from '../../../types';
import { FONT_NAME } from '../../../utils/pdfFonts';
import { getWorksheetAnswerText } from '../shared/answerFormatter';
import { normalizeWorksheetMath } from '../shared/mathNormalizer';
import { PDF_MARGIN, setPdfFont } from './pdfTypes';

export function renderPdfAnswerKey(doc: jsPDF, quiz: Quiz, schoolName: string): void {
    doc.addPage();
    const width = doc.internal.pageSize.getWidth();
    let y = PDF_MARGIN;
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(10);
    doc.text(schoolName.toUpperCase(), width / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(13);
    doc.text('ĐÁP ÁN', width / 2, y, { align: 'center' });
    y += 5;
    setPdfFont(doc, FONT_NAME, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(quiz.title, width / 2, y, { align: 'center' });
    y += 6;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(PDF_MARGIN, y, width - PDF_MARGIN, y);
    y += 5;
    doc.setTextColor(0, 0, 0);

    quiz.questions.forEach((question: any, index) => {
        if (y > doc.internal.pageSize.getHeight() - PDF_MARGIN - 10) {
            doc.addPage();
            y = PDF_MARGIN + 5;
        }
        setPdfFont(doc, FONT_NAME, 'bold');
        doc.setFontSize(9);
        doc.text(`Câu ${index + 1}:`, PDF_MARGIN, y);
        setPdfFont(doc, FONT_NAME, 'normal');
        const lines = doc.splitTextToSize(
            normalizeWorksheetMath(getWorksheetAnswerText(question)),
            width - PDF_MARGIN * 2 - 20,
        );
        doc.text(lines, PDF_MARGIN + 18, y);
        y += Math.max(lines.length * 5, 6) + 2;
    });
}
