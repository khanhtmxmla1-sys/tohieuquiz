import { formatSystemDate } from '../utils/dateTime';

import { Quiz, StudentResult, QuestionType } from '../types';
import { setupUnicodeFont, FONT_NAME } from '../utils/pdfFonts';
import { normalizeWorksheetMath } from './worksheet-export/shared/mathNormalizer';
import {
    getPdfSvgDiagramKey,
    rasterizeSvgDiagramForPdf,
    type PdfSvgDiagramImage,
} from './worksheet-export/pdf/pdfSvgDiagram';

interface ExportOptions {
    quiz: Quiz;
    result: StudentResult;
    answers: Record<string, any>;
    studentName?: string;
    studentClass?: string;
}

/**
 * Export quiz result to PDF
 */
export const exportResultToPDF = async (options: ExportOptions): Promise<void> => {
    const { default: jsPDF } = await import('jspdf');
    const { quiz, result, answers, studentName, studentClass } = options;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const svgDiagrams = new Map<string, PdfSvgDiagramImage>();
    await Promise.all(quiz.questions.map(async (question, index) => {
        const svgContent = (question as unknown as Record<string, unknown>).svgContent;
        if (typeof svgContent !== 'string' || !svgContent.trim()) return;
        const rasterized = await rasterizeSvgDiagramForPdf(svgContent);
        if (rasterized) svgDiagrams.set(getPdfSvgDiagramKey(question, index), rasterized);
    }));

    // Setup Unicode support
    setupUnicodeFont(doc);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Helper function to add new page if needed
    const checkNewPage = (requiredHeight: number = 20) => {
        if (yPos + requiredHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        }
    };

    // Helper to split long text
    const splitText = (text: string, maxWidth: number): string[] => {
        return doc.splitTextToSize(text, maxWidth);
    };

    // ===== HEADER =====
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.rect(0, 0, pageWidth, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(FONT_NAME, 'bold');
    doc.text('KẾT QUẢ BÀI KIỂM TRA', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont(FONT_NAME, 'normal');
    const titleLines = splitText(quiz.title, pageWidth - 2 * margin);
    doc.text(titleLines, pageWidth / 2, 28, { align: 'center' });

    yPos = 55;

    // ===== STUDENT INFO =====
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);

    if (studentName) {
        doc.setFont(FONT_NAME, 'bold');
        doc.text('Họ tên:', margin, yPos);
        doc.setFont(FONT_NAME, 'normal');
        doc.text(studentName, margin + 25, yPos);
        yPos += 7;
    }

    if (studentClass) {
        doc.setFont(FONT_NAME, 'bold');
        doc.text('Lớp:', margin, yPos);
        doc.setFont(FONT_NAME, 'normal');
        doc.text(studentClass, margin + 25, yPos);
        yPos += 7;
    }

    // Date
    doc.setFont(FONT_NAME, 'bold');
    doc.text('Ngày làm:', margin, yPos);
    doc.setFont(FONT_NAME, 'normal');
    doc.text(formatSystemDate(new Date()), margin + 25, yPos);
    yPos += 12;

    // ===== SCORE SECTION =====
    const scoreBoxWidth = 50;
    const scoreBoxHeight = 30;
    const scoreBoxX = (pageWidth - scoreBoxWidth) / 2;

    // Score box background
    const scoreColor = result.score >= 8 ? [16, 185, 129] : // Green
        result.score >= 5 ? [245, 158, 11] : // Yellow
            [239, 68, 68]; // Red

    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.roundedRect(scoreBoxX, yPos, scoreBoxWidth, scoreBoxHeight, 5, 5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(FONT_NAME, 'bold');
    doc.text(result.score.toFixed(1), scoreBoxX + scoreBoxWidth / 2, yPos + 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont(FONT_NAME, 'normal');
    doc.text('ĐIỂM SỐ', scoreBoxX + scoreBoxWidth / 2, yPos + 25, { align: 'center' });

    yPos += scoreBoxHeight + 15;

    // Stats bar
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setTextColor(75, 85, 99);
    doc.setFontSize(10);
    doc.text(`Đúng: ${result.correctCount}/${result.totalQuestions}`, margin, yPos);
    doc.text(`Thời gian: ${result.timeTaken || 0} phút`, pageWidth / 2, yPos, { align: 'center' });
    doc.text(`Xếp loại: ${result.score >= 8 ? 'Giỏi' : result.score >= 6.5 ? 'Khá' : result.score >= 5 ? 'Trung bình' : 'Yếu'}`, pageWidth - margin, yPos, { align: 'center' });

    yPos += 15;

    // ===== QUESTIONS REVIEW =====
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont(FONT_NAME, 'bold');
    doc.text('CHI TIẾT BÀI LÀM', margin, yPos);
    yPos += 10;

    quiz.questions.forEach((question, index) => {
        checkNewPage(40);

        const validation = Array.isArray(result.validationDetails) 
            ? result.validationDetails.find((v: any) => v.questionId === question.id)
            : undefined;
        
        const isCorrect = validation ? validation.isCorrect : true;

        // Question header
        doc.setFillColor(isCorrect ? 240 : 254, isCorrect ? 253 : 242, isCorrect ? 244 : 242);
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');

        doc.setTextColor(isCorrect ? 5 : 153, isCorrect ? 150 : 27, isCorrect ? 105 : 27);
        doc.setFontSize(11);
        doc.setFont(FONT_NAME, 'bold');
        doc.text(`Câu ${index + 1}: ${isCorrect ? 'ĐÚNG' : 'SAI'}`, margin + 2, yPos);
        yPos += 8;

        // Question text
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(FONT_NAME, 'normal');
        
        const qText = normalizeWorksheetMath(
            (question as any).question || (question as any).mainQuestion || '',
        );
        const wrappedQ = splitText(qText, pageWidth - 2 * margin - 5);
        doc.text(wrappedQ, margin + 2, yPos);
        yPos += wrappedQ.length * 5 + 3;

        const diagram = svgDiagrams.get(getPdfSvgDiagramKey(question, index));
        if (diagram) {
            const diagramWidth = Math.min(pageWidth - 2 * margin - 8, 120);
            const diagramHeight = Math.min(70, diagramWidth / diagram.aspectRatio);
            checkNewPage(diagramHeight + 8);
            const diagramX = (pageWidth - diagramWidth) / 2;
            doc.addImage(
                diagram.dataUrl,
                'PNG',
                diagramX,
                yPos,
                diagramWidth,
                diagramHeight,
                undefined,
                'FAST',
            );
            yPos += diagramHeight + 5;
        }

        // Student's answer
        const studentAns = answers[question.id];
        doc.setFont(FONT_NAME, 'bold');
        doc.text('Câu trả lời của bạn:', margin + 2, yPos);
        doc.setFont(FONT_NAME, 'normal');
        
        const ansText = normalizeWorksheetMath(formatAnswer(studentAns, question));
        const wrappedAns = splitText(ansText || 'Không trả lời', pageWidth - 2 * margin - 45);
        doc.text(wrappedAns, margin + 42, yPos);
        yPos += wrappedAns.length * 5 + 3;

        // Correct answer if wrong
        if (!isCorrect) {
            doc.setTextColor(16, 185, 129);
            doc.setFont(FONT_NAME, 'bold');
            doc.text('Đáp án đúng:', margin + 2, yPos);
            doc.setFont(FONT_NAME, 'normal');

            const correctAnsText = normalizeWorksheetMath(formatCorrectAnswer(question));
            const wrappedCorrect = splitText(correctAnsText, pageWidth - 2 * margin - 45);
            doc.text(wrappedCorrect, margin + 42, yPos);
            yPos += wrappedCorrect.length * 5 + 3;
        }

        yPos += 5;
        doc.setTextColor(0, 0, 0);
    });

    // FOOTER
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(
            `KẾT QUẢ BÀI THI - TôHiệuQuiz - Trang ${i} / ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
    }

    doc.save(`Ket-qua-${quiz.title.replace(/\s+/g, '-')}-${studentName || 'Hoc-sinh'}.pdf`);
};

// Helper formats
function formatAnswer(answer: any, question: any): string {
    if (!answer && answer !== 0) return 'Chưa trả lời';
    
    switch (question.type) {
        case QuestionType.MCQ:
            return answer.toString();
        case QuestionType.MULTIPLE_SELECT:
            return Array.isArray(answer) ? answer.join(', ') : answer.toString();
        case QuestionType.TRUE_FALSE:
            return Array.isArray(answer) ? answer.map((a: any) => a ? 'Đúng' : 'Sai').join(', ') : 'N/A';
        default:
            return answer.toString();
    }
}

function formatCorrectAnswer(question: any): string {
    switch (question.type) {
        case QuestionType.MCQ:
            return question.correctAnswer || '';
        case QuestionType.MULTIPLE_SELECT:
            return Array.isArray(question.correctAnswers) ? question.correctAnswers.join(', ') : '';
        case QuestionType.TRUE_FALSE:
            return Array.isArray(question.items) ? question.items.map((it: any) => it.isCorrect ? 'Đúng' : 'Sai').join(', ') : '';
        default:
            return question.correctAnswer || '';
    }
}
