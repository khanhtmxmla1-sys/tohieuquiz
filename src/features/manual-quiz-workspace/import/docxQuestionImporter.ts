import mammoth from 'mammoth';
import { QuestionType } from '../../../types';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import {
    appendImportCandidate,
    createEmptyQuestionImportResult,
    type QuestionImportCandidate,
    type QuestionImportResult,
} from './questionImport.types';

let docxCandidateCounter = 0;
const createId = (prefix: string): string => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `${prefix}-${uuid}`;
    docxCandidateCounter += 1;
    return `${prefix}-${docxCandidateCounter}`;
};

interface DocxBlock {
    number: number;
    body: string;
}

const splitQuestionBlocks = (rawText: string): DocxBlock[] => {
    const normalized = rawText.replace(/\r/g, '').trim();
    const matches = Array.from(normalized.matchAll(/(?:^|\n)\s*Câu\s+(\d+)\s*[:.)-]\s*/gi));
    return matches.map((match, index) => ({
        number: Number(match[1]) || index + 1,
        body: normalized.slice((match.index || 0) + match[0].length, matches[index + 1]?.index ?? normalized.length).trim(),
    }));
};

const parseBlock = ({ number, body }: DocxBlock): QuestionImportCandidate => {
    const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
    const optionLines = lines.filter((line) => /^[A-D][.)]\s*/i.test(line));
    const answerLine = lines.find((line) => /^(Đáp án|Dap an|Answer)\s*:/i.test(line));
    const explanationLine = lines.find((line) => /^(Giải thích|Giai thich|Lời giải|Loi giai)\s*:/i.test(line));
    const firstSpecialIndex = lines.findIndex((line) => /^[A-D][.)]\s*/i.test(line)
        || /^(Đáp án|Dap an|Answer|Giải thích|Giai thich|Lời giải|Loi giai)\s*:/i.test(line));
    const questionText = lines.slice(0, firstSpecialIndex < 0 ? lines.length : firstSpecialIndex).join(' ').trim();
    const options = optionLines.map((line) => line.replace(/^[A-D][.)]\s*/i, '').trim());
    const answer = (answerLine?.split(':').slice(1).join(':').trim() || '').toUpperCase();
    const explanation = explanationLine?.split(':').slice(1).join(':').trim() || undefined;
    const issues: string[] = [];

    if (!questionText) issues.push('Thiếu nội dung câu hỏi.');
    if (options.length > 0 && options.length < 2) issues.push('Cần ít nhất hai phương án.');
    if (!answer) issues.push('Thiếu đáp án đúng.');
    if (options.length > 0 && answer && !options[answer.charCodeAt(0) - 65]) {
        issues.push('Đáp án đúng không khớp với phương án hiện có.');
    }

    const type = options.length >= 2 ? QuestionType.MCQ : QuestionType.SHORT_ANSWER;
    const question = (type === QuestionType.MCQ ? {
        id: createId('import-docx-question'),
        type,
        question: questionText,
        options,
        correctAnswer: answer,
        difficulty: 1,
        points: 1,
        explanation,
    } : {
        id: createId('import-docx-question'),
        type,
        question: questionText,
        correctAnswer: answer,
        difficulty: 1,
        points: 1,
        explanation,
    }) as ManualQuizQuestion;

    return {
        id: createId('import-docx-candidate'),
        sourceRow: number,
        sourceLabel: `Câu ${number}`,
        status: !questionText ? 'rejected' : issues.length > 0 ? 'needsReview' : 'accepted',
        issues,
        question,
    };
};

export const parseDocxQuestionText = (rawText: string): QuestionImportResult => {
    const result = createEmptyQuestionImportResult();
    const blocks = splitQuestionBlocks(rawText);
    if (blocks.length === 0 && rawText.trim()) {
        appendImportCandidate(result, {
            id: createId('import-docx-candidate'),
            sourceRow: 1,
            sourceLabel: 'Nội dung chưa nhận diện',
            status: 'rejected',
            issues: ['Không nhận diện được cấu trúc “Câu 1: …”.'],
            question: {
                id: createId('import-docx-question'),
                type: QuestionType.SHORT_ANSWER,
                question: rawText.trim(),
                correctAnswer: '',
                difficulty: 1,
                points: 1,
            } as ManualQuizQuestion,
        });
        return result;
    }
    blocks.forEach((block) => appendImportCandidate(result, parseBlock(block)));
    return result;
};

const readArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Không thể đọc tệp DOCX.'));
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(file);
    });
};

export const importQuestionDocx = async (file: File): Promise<QuestionImportResult> => {
    const arrayBuffer = await readArrayBuffer(file);
    const runtimeBuffer = (globalThis as typeof globalThis & {
        Buffer?: { from(value: ArrayBuffer): unknown };
    }).Buffer;
    const source = runtimeBuffer
        ? { buffer: runtimeBuffer.from(arrayBuffer) }
        : { arrayBuffer };
    const extracted = await mammoth.extractRawText(source as Parameters<typeof mammoth.extractRawText>[0]);
    return parseDocxQuestionText(extracted.value);
};
