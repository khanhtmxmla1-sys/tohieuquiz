import { QuestionType } from '../../../types';
import { FONT_NAME } from '../../../utils/pdfFonts';
import { getWorksheetTypeLabel } from '../shared/typeLabels';
import { ensurePdfSpace } from './pdfLayout';
import { renderPdfMathText } from './pdfMath';
import { renderPdfQuestionMedia } from './pdfMedia';
import { PDF_MARGIN, type PdfRenderContext, setPdfFont } from './pdfTypes';
import { renderPdfSvgDiagram } from './pdfSvgDiagram';
import { renderPdfChoices } from './renderers/choiceRenderer';
import { renderPdfMatching, renderPdfDragDrop } from './renderers/matchingDragRenderer';
import { renderPdfCategorization, renderPdfDropdown, renderPdfOrdering, renderPdfWordScramble } from './renderers/structuredRenderer';
import { renderPdfTrueFalse } from './renderers/trueFalseRenderer';
import { renderPdfErrorCorrection, renderPdfFallback, renderPdfRiddle, renderPdfUnderline, renderPdfWritingLines } from './renderers/writingRenderer';
import { renderPdfGeometry } from './pdfGeometry';

export function renderPdfQuestion(ctx: PdfRenderContext, question: any, index: number): void {
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    ensurePdfSpace(ctx, 30);
    setPdfFont(doc, FONT_NAME, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const header = `Câu ${index + 1} [${getWorksheetTypeLabel(question.type)}]: `;
    const text = question.question || question.mainQuestion || '';
    doc.text(header, PDF_MARGIN, ctx.yPos);
    setPdfFont(doc, FONT_NAME, 'normal');
    const headerWidth = doc.getTextWidth(header);
    const questionHeight = renderPdfMathText(
        doc,
        text,
        PDF_MARGIN + headerWidth,
        ctx.yPos,
        contentWidth - headerWidth,
    );
    ctx.yPos += questionHeight + 2;
    renderPdfQuestionMedia(ctx, index, Array.isArray(question.options) ? question.options.length : 0);
    const hasStructuredGeometry = question.type === QuestionType.GEOMETRY
        && question.geometryData
        && typeof question.geometryData === 'object';
    const renderedSvg = hasStructuredGeometry ? false : renderPdfSvgDiagram(ctx, question, index);

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
            renderPdfWritingLines(ctx);
            break;
        case QuestionType.RIDDLE:
            renderPdfRiddle(ctx, question);
            break;
        case QuestionType.MATCHING:
            renderPdfMatching(ctx, question);
            break;
        case QuestionType.DRAG_DROP:
            renderPdfDragDrop(ctx, question);
            break;
        case QuestionType.DROPDOWN:
            renderPdfDropdown(ctx, question);
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
        case QuestionType.GEOMETRY:
            if (!renderedSvg) renderPdfGeometry(ctx, question);
            renderPdfWritingLines(ctx);
            break;
        default:
            renderPdfFallback(ctx);
    }
    ctx.yPos += 3;
}
