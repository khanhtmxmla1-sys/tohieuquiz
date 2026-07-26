import { QuestionType } from '../../../types';
import { FONT_NAME } from '../../../utils/pdfFonts';
import { normalizeWorksheetMath } from '../shared/mathNormalizer';
import { getWorksheetTypeLabel } from '../shared/typeLabels';
import { ensurePdfSpace } from './pdfLayout';
import { PDF_MARGIN, type PdfRenderContext, setPdfFont } from './pdfTypes';
import { renderPdfChoices } from './renderers/choiceRenderer';
import { renderPdfMatching, renderPdfDragDrop } from './renderers/matchingDragRenderer';
import { renderPdfCategorization, renderPdfOrdering, renderPdfWordScramble } from './renderers/structuredRenderer';
import { renderPdfTrueFalse } from './renderers/trueFalseRenderer';
import { renderPdfErrorCorrection, renderPdfFallback, renderPdfUnderline, renderPdfWritingLines } from './renderers/writingRenderer';

export function renderPdfQuestion(ctx: PdfRenderContext, question: any, index: number): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    ensurePdfSpace(ctx, 30);
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const header = `Câu ${index + 1} [${getWorksheetTypeLabel(question.type)}]: `;
    const text = normalizeWorksheetMath(question.question || question.mainQuestion || '');
    doc.text(header, PDF_MARGIN, ctx.yPos);
    setPdfFont(doc, FONT_NAME, 'normal');
    const headerWidth = doc.getTextWidth(header);
    const lines = doc.splitTextToSize(text, contentWidth - headerWidth);
    doc.text(lines[0] || '', PDF_MARGIN + headerWidth, ctx.yPos);
    ctx.yPos += 5;
    if (lines.length > 1) {
        const rest = doc.splitTextToSize(lines.slice(1).join('\n'), contentWidth);
        doc.text(rest, PDF_MARGIN + 4, ctx.yPos);
        ctx.yPos += rest.length * 5;
    }
    ctx.yPos += 2;

    switch (question.type) {
        case QuestionType.MCQ:
        case QuestionType.MULTIPLE_SELECT:
        case QuestionType.IMAGE_QUESTION:
            renderPdfChoices(ctx, question);
            break;
        case QuestionType.TRUE_FALSE:
            renderPdfTrueFalse(ctx, question);
            break;
        case QuestionType.SHORT_ANSWER:
        case QuestionType.RIDDLE:
            renderPdfWritingLines(ctx);
            break;
        case QuestionType.MATCHING:
            renderPdfMatching(ctx, question);
            break;
        case QuestionType.DRAG_DROP:
            renderPdfDragDrop(ctx, question);
            break;
        case QuestionType.ORDERING:
            renderPdfOrdering(ctx, question);
            break;
        case QuestionType.CATEGORIZATION:
            renderPdfCategorization(ctx, question);
            break;
        case QuestionType.WORD_SCRAMBLE:
            renderPdfWordScramble(ctx, question);
            break;
        case QuestionType.UNDERLINE:
            renderPdfUnderline(ctx, question);
            break;
        case QuestionType.ERROR_CORRECTION:
            renderPdfErrorCorrection(ctx, question);
            break;
        default:
            renderPdfFallback(ctx);
    }
    ctx.yPos += 3;
}
