import { Paragraph } from 'docx';
import { QuestionType } from '../../../types';
import { createDocxAnswerLine } from './docxHelpers';
import { worksheetMathChildren, worksheetTextRun } from './docxStyle';
import type { WorksheetImageAssetMap } from '../shared/media';
import { renderDocxQuestionMedia } from './docxMedia';
import { renderDocxDiagram } from './docxDiagram';
import { renderDocxChoices } from './renderers/choiceRenderer';
import { renderDocxDragDrop, renderDocxMatching } from './renderers/matchingDragRenderer';
import {
    renderDocxCategorization,
    renderDocxDropdown,
    renderDocxOrdering,
    renderDocxWordScramble,
} from './renderers/structuredRenderer';
import { renderDocxTrueFalse } from './renderers/trueFalseRenderer';
import {
    renderDocxErrorCorrection,
    renderDocxGeometryAnswerArea,
    renderDocxRiddle,
    renderDocxUnderline,
} from './renderers/writingRenderer';

export function renderDocxQuestion(
    question: any,
    index: number,
    imageAssets?: WorksheetImageAssetMap,
): any[] {
    const questionText = question.question || question.mainQuestion || '';
    const children: any[] = [new Paragraph({
        children: [
            worksheetTextRun({ text: `Câu ${index + 1}: `, bold: true, size: 28 }),
            ...worksheetMathChildren(questionText, { size: 28 }),
        ],
        spacing: { before: 0, after: 0, line: 320 },
    })];

    children.push(...renderDocxQuestionMedia(
        index,
        Array.isArray(question.options) ? question.options.length : 0,
        imageAssets,
    ));
    children.push(...renderDocxDiagram(question));

    switch (question.type) {
        case QuestionType.MCQ:
        case QuestionType.MULTIPLE_SELECT:
        case QuestionType.IMAGE_QUESTION:
            children.push(...renderDocxChoices(question));
            break;
        case QuestionType.TRUE_FALSE:
            children.push(renderDocxTrueFalse(question));
            break;
        case QuestionType.SHORT_ANSWER:
            children.push(createDocxAnswerLine());
            break;
        case QuestionType.MATCHING:
            children.push(renderDocxMatching(question));
            break;
        case QuestionType.DRAG_DROP:
            children.push(...renderDocxDragDrop(question));
            break;
        case QuestionType.DROPDOWN:
            children.push(...renderDocxDropdown(question));
            break;
        case QuestionType.ORDERING:
            children.push(...renderDocxOrdering(question));
            break;
        case QuestionType.UNDERLINE:
            children.push(...renderDocxUnderline(question));
            break;
        case QuestionType.CATEGORIZATION:
            children.push(...renderDocxCategorization(question));
            break;
        case QuestionType.WORD_SCRAMBLE:
            children.push(...renderDocxWordScramble(question));
            break;
        case QuestionType.RIDDLE:
            children.push(...renderDocxRiddle(question));
            break;
        case QuestionType.ERROR_CORRECTION:
            children.push(...renderDocxErrorCorrection(question));
            break;
        case QuestionType.GEOMETRY:
            children.push(...renderDocxGeometryAnswerArea());
            break;
        default:
            children.push(createDocxAnswerLine());
    }
    return children;
}
