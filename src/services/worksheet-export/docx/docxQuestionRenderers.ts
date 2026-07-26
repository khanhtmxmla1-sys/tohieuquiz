import { Paragraph, TextRun } from 'docx';
import { QuestionType } from '../../../types';
import { createDocxAnswerLine } from './docxHelpers';
import { createDocxMathChildren } from './docxMath';
import { renderDocxChoices } from './renderers/choiceRenderer';
import { renderDocxDragDrop, renderDocxMatching } from './renderers/matchingDragRenderer';
import { renderDocxTrueFalse } from './renderers/trueFalseRenderer';

export function renderDocxQuestion(question: any, index: number): any[] {
    const questionText = question.question || question.mainQuestion || '';
    const children: any[] = [new Paragraph({
        children: [
            new TextRun({ text: `Câu ${index + 1}: `, bold: true, size: 28 }),
            ...createDocxMathChildren(questionText, { size: 28 }),
        ],
        spacing: { before: 0, after: 0, line: 320 },
    })];

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
        case QuestionType.RIDDLE:
            children.push(createDocxAnswerLine());
            break;
        case QuestionType.MATCHING:
            children.push(renderDocxMatching(question));
            break;
        case QuestionType.DRAG_DROP:
            children.push(...renderDocxDragDrop(question));
            break;
        default:
            children.push(createDocxAnswerLine());
    }
    return children;
}
