import Papa from 'papaparse';
import { QuestionType } from '../../../types';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import {
    appendImportCandidate,
    createEmptyQuestionImportResult,
    type QuestionImportCandidate,
    type QuestionImportResult,
    type QuestionImportStatus,
} from './questionImport.types';

const HEADER_ALIASES: Record<string, string[]> = {
    type: ['type', 'loai', 'loai_cau_hoi', 'dạng', 'dang'],
    question: ['question', 'cau_hoi', 'nội_dung', 'noi_dung'],
    optionA: ['optiona', 'option_a', 'dap_an_a', 'đáp_án_a'],
    optionB: ['optionb', 'option_b', 'dap_an_b', 'đáp_án_b'],
    optionC: ['optionc', 'option_c', 'dap_an_c', 'đáp_án_c'],
    optionD: ['optiond', 'option_d', 'dap_an_d', 'đáp_án_d'],
    correctAnswer: ['correctanswer', 'correct_answer', 'dap_an_dung', 'đáp_án_đúng'],
    difficulty: ['difficulty', 'do_kho', 'độ_khó'],
    points: ['points', 'diem', 'điểm'],
    explanation: ['explanation', 'loi_giai', 'lời_giải'],
    subject: ['subject', 'mon', 'môn'],
    image: ['image', 'anh', 'ảnh'],
    imageAlt: ['imagealt', 'image_alt', 'mo_ta_anh', 'mô_tả_ảnh'],
};

let candidateCounter = 0;
const createCandidateId = (): string => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `import-candidate-${uuid}`;
    candidateCounter += 1;
    return `import-candidate-${candidateCounter}`;
};

const normalizeHeader = (value: string): string => value
    .trim()
    .toLocaleLowerCase('vi')
    .replace(/[\s-]+/g, '_');

const normalizeRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const source = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
    return Object.fromEntries(Object.entries(HEADER_ALIASES).map(([canonical, aliases]) => {
        const value = aliases.map(normalizeHeader).map((alias) => source.get(alias)).find((entry) => entry !== undefined);
        return [canonical, value];
    }));
};

const text = (value: unknown): string => String(value ?? '').trim();

const normalizeQuestionType = (value: unknown, options: string[]): { type: QuestionType; inferred: boolean } => {
    const raw = text(value).toUpperCase().replace(/[\s-]+/g, '_');
    if (Object.values(QuestionType).includes(raw as QuestionType) && raw !== QuestionType.GEOMETRY) {
        return { type: raw as QuestionType, inferred: false };
    }
    return { type: options.length >= 2 ? QuestionType.MCQ : QuestionType.SHORT_ANSWER, inferred: true };
};

const parseDifficulty = (value: unknown): 1 | 2 | 3 => {
    const numeric = Number(value);
    return numeric === 2 || numeric === 3 ? numeric : 1;
};

const parsePoints = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

const createQuestion = (
    row: Record<string, unknown>,
    type: QuestionType,
    options: string[],
    correctAnswer: string,
): ManualQuizQuestion => {
    const base = {
        id: `import-question-${createCandidateId()}`,
        type,
        difficulty: parseDifficulty(row.difficulty),
        points: parsePoints(row.points),
        explanation: text(row.explanation) || undefined,
        subject: text(row.subject) || undefined,
        image: text(row.image) || undefined,
        imageAlt: text(row.imageAlt) || undefined,
    };
    if (type === QuestionType.MCQ || type === QuestionType.IMAGE_QUESTION) {
        return { ...base, type, question: text(row.question), options, correctAnswer } as ManualQuizQuestion;
    }
    if (type === QuestionType.MULTIPLE_SELECT) {
        return {
            ...base,
            type,
            question: text(row.question),
            options,
            correctAnswers: correctAnswer.split(/[;,]/).map((item) => item.trim()).filter(Boolean),
        } as ManualQuizQuestion;
    }
    return { ...base, type: QuestionType.SHORT_ANSWER, question: text(row.question), correctAnswer } as ManualQuizQuestion;
};

const classifyRow = (row: Record<string, unknown>, sourceRow: number): QuestionImportCandidate => {
    const normalized = normalizeRow(row);
    const questionText = text(normalized.question);
    const options = ['optionA', 'optionB', 'optionC', 'optionD']
        .map((key) => text(normalized[key]))
        .filter(Boolean);
    const answer = text(normalized.correctAnswer).toUpperCase();
    const normalizedType = normalizeQuestionType(normalized.type, options);
    const issues: string[] = [];
    let status: QuestionImportStatus = 'accepted';

    if (!questionText) {
        issues.push('Thiếu nội dung câu hỏi.');
        status = 'rejected';
    }
    if (normalizedType.inferred) {
        issues.push('Loại câu hỏi chưa được nhận diện; hệ thống đã tạm suy đoán.');
        if (status !== 'rejected') status = 'needsReview';
    }
    if ([QuestionType.MCQ, QuestionType.IMAGE_QUESTION, QuestionType.MULTIPLE_SELECT].includes(normalizedType.type) && options.length < 2) {
        issues.push('Cần ít nhất hai phương án.');
        if (status !== 'rejected') status = 'needsReview';
    }
    if (!answer) {
        issues.push('Thiếu đáp án đúng.');
        if (status !== 'rejected') status = 'needsReview';
    }
    if ((normalizedType.type === QuestionType.MCQ || normalizedType.type === QuestionType.IMAGE_QUESTION)
        && answer && !options[answer.charCodeAt(0) - 65]) {
        issues.push('Đáp án đúng không khớp với phương án hiện có.');
        if (status !== 'rejected') status = 'needsReview';
    }

    return {
        id: createCandidateId(),
        sourceRow,
        sourceLabel: `Dòng ${sourceRow}`,
        status,
        issues,
        question: createQuestion(normalized, normalizedType.type, options, answer),
    };
};

export const parseSpreadsheetRows = (rows: Record<string, unknown>[]): QuestionImportResult => {
    const result = createEmptyQuestionImportResult();
    rows.forEach((row, index) => appendImportCandidate(result, classifyRow(row, index + 2)));
    return result;
};

export const parseQuestionCsvText = (csvText: string): QuestionImportResult => {
    const parsed = Papa.parse<Record<string, unknown>>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
    });
    return parseSpreadsheetRows(parsed.data);
};

const worksheetRows = (worksheet: readonly (readonly unknown[])[]): Record<string, unknown>[] => {
    const headers = (worksheet[0] ?? []).map((value) => text(value));
    return worksheet.slice(1)
        .filter((row) => row.some((value) => text(value) !== ''))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
};

const readFile = <T extends string | ArrayBuffer>(file: File, mode: 'text' | 'arrayBuffer'): Promise<T> => {
    if (mode === 'text' && typeof file.text === 'function') return file.text() as Promise<T>;
    if (mode === 'arrayBuffer' && typeof file.arrayBuffer === 'function') return file.arrayBuffer() as Promise<T>;
    return new Promise<T>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Không thể đọc tệp.'));
        reader.onload = () => resolve(reader.result as T);
        if (mode === 'text') reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
    });
};

export const importQuestionSpreadsheet = async (file: File): Promise<QuestionImportResult> => {
    if (file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv')) {
        return parseQuestionCsvText(await readFile<string>(file, 'text'));
    }
    const { readSheet } = await import('read-excel-file/browser');
    const worksheet = await readSheet(await readFile<ArrayBuffer>(file, 'arrayBuffer'));
    return worksheet.length > 0
        ? parseSpreadsheetRows(worksheetRows(worksheet))
        : createEmptyQuestionImportResult();
};
