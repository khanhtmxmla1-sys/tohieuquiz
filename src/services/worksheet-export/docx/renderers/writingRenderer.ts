import { Paragraph } from 'docx';
import { createDocxAnswerLine } from '../docxHelpers';
import { worksheetMathChildren } from '../docxStyle';

export function renderDocxUnderline(question: any): any[] {
    return [
        new Paragraph({
            children: worksheetMathChildren(question.sentence || '', { size: 28 }),
            spacing: { before: 40, after: 40, line: 320 },
        }),
        createDocxAnswerLine('Từ/cụm từ được gạch chân: '),
    ];
}

export function renderDocxRiddle(question: any): any[] {
    const children: any[] = (question.riddleLines || []).map((line: unknown) => new Paragraph({
        children: worksheetMathChildren(line, { size: 28 }),
        spacing: { before: 20, after: 20, line: 320 },
    }));
    children.push(createDocxAnswerLine(`${question.answerLabel || 'Trả lời'}: `));
    return children;
}

export function renderDocxErrorCorrection(question: any): any[] {
    return [
        new Paragraph({
            children: worksheetMathChildren(question.passage || '', { size: 28 }),
            spacing: { before: 40, after: 40, line: 320 },
        }),
        createDocxAnswerLine('Từ sai và cách sửa: '),
    ];
}

export function renderDocxGeometryAnswerArea(): any[] {
    return [createDocxAnswerLine('Trả lời: ')];
}
