import { QuestionType } from '../../../types';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import {
    appendImportCandidate,
    createEmptyQuestionImportResult,
    type QuestionImportCandidate,
    type QuestionImportResult,
    type QuestionImportStatus,
} from './questionImport.types';

export const QUESTION_JSON_EXAMPLE = JSON.stringify({
    questions: [
        {
            type: 'multiple_choice',
            question: '2 + 3 bằng bao nhiêu?',
            options: ['4', '5', '6', '7'],
            answer: '5',
            explanation: 'Hai cộng ba bằng năm.',
            difficulty: 1,
            points: 1,
        },
    ],
}, null, 2);

type JsonRecord = Record<string, unknown>;

let jsonCandidateCounter = 0;

const createId = (prefix: string): string => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `${prefix}-${uuid}`;
    jsonCandidateCounter += 1;
    return `${prefix}-${jsonCandidateCounter}`;
};

const isRecord = (value: unknown): value is JsonRecord => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const text = (value: unknown): string => String(value ?? '').trim();

const firstText = (row: JsonRecord, keys: string[]): string => {
    for (const key of keys) {
        const value = text(row[key]);
        if (value) return value;
    }
    return '';
};

const parseDifficulty = (value: unknown): 1 | 2 | 3 => {
    const numeric = Number(value);
    return numeric === 2 || numeric === 3 ? numeric : 1;
};

const parsePoints = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

const normalizeTypeToken = (value: unknown): string => text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const TYPE_ALIASES: Record<string, QuestionType> = {
    mcq: QuestionType.MCQ,
    multiple_choice: QuestionType.MCQ,
    multiplechoice: QuestionType.MCQ,
    true_false: QuestionType.TRUE_FALSE,
    truefalse: QuestionType.TRUE_FALSE,
    short_answer: QuestionType.SHORT_ANSWER,
    shortanswer: QuestionType.SHORT_ANSWER,
    matching: QuestionType.MATCHING,
    match: QuestionType.MATCHING,
    multiple_select: QuestionType.MULTIPLE_SELECT,
    multiselect: QuestionType.MULTIPLE_SELECT,
};

const normalizeQuestionType = (
    value: unknown,
    options: string[],
): { type: QuestionType; inferred: boolean } => {
    const raw = normalizeTypeToken(value);
    const direct = TYPE_ALIASES[raw];
    if (direct) return { type: direct, inferred: false };

    const enumMatch = Object.values(QuestionType).find((entry) => entry.toLowerCase() === raw);
    if (enumMatch && [
        QuestionType.MCQ,
        QuestionType.TRUE_FALSE,
        QuestionType.SHORT_ANSWER,
        QuestionType.MATCHING,
        QuestionType.MULTIPLE_SELECT,
    ].includes(enumMatch)) {
        return { type: enumMatch, inferred: false };
    }

    return {
        type: options.length >= 2 ? QuestionType.MCQ : QuestionType.SHORT_ANSWER,
        inferred: true,
    };
};

const normalizeOptions = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map((option) => {
        if (isRecord(option)) {
            return firstText(option, ['text', 'label', 'value', 'content']);
        }
        return text(option);
    }).filter(Boolean);
};

const optionLetter = (index: number): string => String.fromCharCode(65 + index);

const normalizeSingleChoiceAnswer = (value: unknown, options: string[]): string => {
    const answer = text(value);
    if (!answer) return '';

    const upper = answer.toUpperCase();
    if (/^[A-Z]$/.test(upper)) {
        const index = upper.charCodeAt(0) - 65;
        if (options[index] !== undefined) return upper;
    }

    const normalizedAnswer = answer.toLocaleLowerCase('vi');
    const matchingIndex = options.findIndex((option) => option.toLocaleLowerCase('vi') === normalizedAnswer);
    return matchingIndex >= 0 ? optionLetter(matchingIndex) : answer;
};

const normalizeMultipleAnswers = (value: unknown, options: string[]): string[] => {
    const values = Array.isArray(value)
        ? value
        : text(value).split(/[;,]/).map((entry) => entry.trim()).filter(Boolean);
    return values
        .map((entry) => normalizeSingleChoiceAnswer(entry, options))
        .filter(Boolean);
};

const normalizeBoolean = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value;
    const normalized = text(value).toLocaleLowerCase('vi');
    if (['true', 'đúng', 'dung', 'yes'].includes(normalized)) return true;
    if (['false', 'sai', 'no'].includes(normalized)) return false;
    return null;
};

const normalizeTrueFalseItems = (value: unknown): Array<{ id: string; statement: string; isCorrect: boolean }> => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isRecord(item)) return [];
        const statement = firstText(item, ['statement', 'text', 'content']);
        const correct = normalizeBoolean(item.isCorrect ?? item.answer);
        if (!statement || correct === null) return [];
        return [{
            id: createId('import-json-tf-item'),
            statement,
            isCorrect: correct,
        }];
    });
};

const normalizeMatchingPairs = (value: unknown): Array<{ left: string; right: string }> => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((pair) => {
        if (!isRecord(pair)) return [];
        const left = text(pair.left);
        const right = text(pair.right);
        return left && right ? [{ left, right }] : [];
    });
};

const extractQuestions = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.questions)) return value.questions;
    throw new Error('JSON phải là một mảng câu hỏi hoặc object có trường "questions".');
};

const createBaseQuestion = (row: JsonRecord) => ({
    id: createId('import-json-question'),
    difficulty: parseDifficulty(row.difficulty),
    points: parsePoints(row.points),
    explanation: firstText(row, ['explanation', 'solution']) || undefined,
    subject: text(row.subject) || undefined,
    image: text(row.image) || undefined,
    imageAlt: firstText(row, ['imageAlt', 'image_alt']) || undefined,
});

const classifyQuestion = (raw: unknown, index: number): QuestionImportCandidate => {
    const sourceRow = index + 1;
    const sourceLabel = `Câu JSON ${sourceRow}`;

    if (!isRecord(raw)) {
        return {
            id: createId('import-json-candidate'),
            sourceRow,
            sourceLabel,
            status: 'rejected',
            issues: ['Câu hỏi phải là một object JSON.'],
            question: {
                id: createId('import-json-question'),
                type: QuestionType.SHORT_ANSWER,
                question: '',
                correctAnswer: '',
                difficulty: 1,
                points: 1,
            } as ManualQuizQuestion,
        };
    }

    const options = normalizeOptions(raw.options);
    const normalizedType = normalizeQuestionType(raw.type, options);
    const prompt = firstText(raw, ['question', 'questionText', 'text', 'mainQuestion']);
    const rawAnswer = raw.correctAnswers ?? raw.correctAnswer ?? raw.answer;
    const issues: string[] = [];
    let status: QuestionImportStatus = 'accepted';

    if (!prompt) {
        issues.push('Thiếu nội dung câu hỏi.');
        status = 'rejected';
    }

    if (normalizedType.inferred) {
        issues.push('Loại câu hỏi chưa được nhận diện; hệ thống đã tạm suy đoán.');
        if (status !== 'rejected') status = 'needsReview';
    }

    const base = createBaseQuestion(raw);
    let question: ManualQuizQuestion;

    if (normalizedType.type === QuestionType.TRUE_FALSE) {
        const items = normalizeTrueFalseItems(raw.items);
        if (items.length === 0) {
            issues.push('Câu Đúng/Sai cần ít nhất một mệnh đề hợp lệ.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.TRUE_FALSE,
            mainQuestion: prompt,
            items,
        } as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.MATCHING) {
        const pairs = normalizeMatchingPairs(raw.pairs);
        if (pairs.length === 0) {
            issues.push('Câu nối cột cần ít nhất một cặp hợp lệ.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.MATCHING,
            question: prompt,
            pairs,
        } as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.MULTIPLE_SELECT) {
        const correctAnswers = normalizeMultipleAnswers(rawAnswer, options);
        if (options.length < 2) {
            issues.push('Cần ít nhất hai phương án.');
            if (status !== 'rejected') status = 'needsReview';
        }
        if (correctAnswers.length === 0) {
            issues.push('Thiếu đáp án đúng.');
            if (status !== 'rejected') status = 'needsReview';
        } else if (correctAnswers.some((answer) => !/^[A-Z]$/.test(answer) || options[answer.charCodeAt(0) - 65] === undefined)) {
            issues.push('Đáp án đúng không khớp với phương án hiện có.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.MULTIPLE_SELECT,
            question: prompt,
            options,
            correctAnswers,
        } as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.MCQ) {
        const correctAnswer = normalizeSingleChoiceAnswer(rawAnswer, options);
        if (options.length < 2) {
            issues.push('Cần ít nhất hai phương án.');
            if (status !== 'rejected') status = 'needsReview';
        }
        if (!correctAnswer) {
            issues.push('Thiếu đáp án đúng.');
            if (status !== 'rejected') status = 'needsReview';
        } else if (!/^[A-Z]$/.test(correctAnswer) || options[correctAnswer.charCodeAt(0) - 65] === undefined) {
            issues.push('Đáp án đúng không khớp với phương án hiện có.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.MCQ,
            question: prompt,
            options,
            correctAnswer,
        } as ManualQuizQuestion;
    } else {
        const correctAnswer = text(rawAnswer);
        if (!correctAnswer) {
            issues.push('Thiếu đáp án đúng.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.SHORT_ANSWER,
            question: prompt,
            correctAnswer,
        } as ManualQuizQuestion;
    }

    return {
        id: createId('import-json-candidate'),
        sourceRow,
        sourceLabel,
        status,
        issues,
        question,
    };
};

export const parseQuestionJsonText = (rawText: string): QuestionImportResult => {
    if (!rawText.trim()) {
        throw new Error('JSON đang trống. Hãy dán dữ liệu câu hỏi trước khi kiểm tra.');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawText) as unknown;
    } catch {
        throw new Error('JSON không hợp lệ. Hãy kiểm tra dấu ngoặc, dấu phẩy và dấu ngoặc kép.');
    }

    const result = createEmptyQuestionImportResult();
    const questions = extractQuestions(parsed);
    questions.forEach((question, index) => appendImportCandidate(result, classifyQuestion(question, index)));
    return result;
};
