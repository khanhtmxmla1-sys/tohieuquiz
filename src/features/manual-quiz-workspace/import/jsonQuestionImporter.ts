import { QuestionType } from '../../../types';
import {
    parseQuestionRichText,
    type QuestionRichTextEnvelopeV1,
} from '../../../../shared/question-rich-text.contract';
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
            id: 'Q001',
            question_type: 'SINGLE_CHOICE',
            difficulty: 'NHAN_BIET',
            points: 1,
            question: '<strong>Chọn đáp án đúng.</strong>\n2 + 3 bằng bao nhiêu?',
            options: [
                { id: 'A', text: '4' },
                { id: 'B', text: '5' },
                { id: 'C', text: '6' },
                { id: 'D', text: '7' },
            ],
            correct_answer: 'B',
            explanation: 'Hai cộng ba bằng năm.',
        },
    ],
}, null, 2);
type JsonRecord = Record<string, unknown>;

type ImportedManualQuizQuestion = ManualQuizQuestion & {
    questionRichText?: QuestionRichTextEnvelopeV1;
};

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

const DIFFICULTY_ALIASES: Record<string, 1 | 2 | 3> = {
    nhan_biet: 1,
    thong_hieu: 2,
    van_dung: 3,
};

const parseDifficulty = (value: unknown): 1 | 2 | 3 => {
    const token = text(value).toLowerCase().replace(/[\s-]+/g, '_');
    const aliased = DIFFICULTY_ALIASES[token];
    if (aliased) return aliased;
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

const LEGACY_TYPE_ALIASES: Record<string, QuestionType> = {
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
    single_choice: QuestionType.MCQ,
    drag_drop: QuestionType.DRAG_DROP,
    drag_drop_fill: QuestionType.DRAG_DROP,
    ordering: QuestionType.ORDERING,
    image_question: QuestionType.IMAGE_QUESTION,
    dropdown: QuestionType.DROPDOWN,
    underline: QuestionType.UNDERLINE,
    categorization: QuestionType.CATEGORIZATION,
    word_scramble: QuestionType.WORD_SCRAMBLE,
    word_assembly: QuestionType.WORD_SCRAMBLE,
    riddle: QuestionType.RIDDLE,
};

const CANONICAL_TYPE_ALIASES: Record<string, QuestionType> = {
    single_choice: QuestionType.MCQ,
    true_false: QuestionType.TRUE_FALSE,
    short_answer: QuestionType.SHORT_ANSWER,
    matching: QuestionType.MATCHING,
    multiple_choice: QuestionType.MULTIPLE_SELECT,
    drag_drop_fill: QuestionType.DRAG_DROP,
    ordering: QuestionType.ORDERING,
    dropdown: QuestionType.DROPDOWN,
    underline: QuestionType.UNDERLINE,
    image_question: QuestionType.IMAGE_QUESTION,
    categorization: QuestionType.CATEGORIZATION,
    word_assembly: QuestionType.WORD_SCRAMBLE,
    riddle: QuestionType.RIDDLE,
};

interface NormalizedQuestionType {
    type: QuestionType;
    inferred: boolean;
    conflict: boolean;
}

const normalizeLegacyType = (value: unknown): QuestionType | undefined => {
    const raw = normalizeTypeToken(value);
    const direct = LEGACY_TYPE_ALIASES[raw];
    if (direct) return direct;

    const enumMatch = Object.values(QuestionType).find((entry) => entry.toLowerCase() === raw);
    if (enumMatch && [
        QuestionType.MCQ,
        QuestionType.TRUE_FALSE,
        QuestionType.SHORT_ANSWER,
        QuestionType.MATCHING,
        QuestionType.MULTIPLE_SELECT,
        QuestionType.DRAG_DROP,
        QuestionType.ORDERING,
        QuestionType.IMAGE_QUESTION,
        QuestionType.DROPDOWN,
        QuestionType.UNDERLINE,
        QuestionType.CATEGORIZATION,
        QuestionType.WORD_SCRAMBLE,
        QuestionType.RIDDLE,
    ].includes(enumMatch)) {
        return enumMatch;
    }
    return undefined;
};

const normalizeQuestionType = (
    row: JsonRecord,
    options: string[],
): NormalizedQuestionType => {
    const canonicalToken = normalizeTypeToken(row.question_type);
    const canonicalType = canonicalToken ? CANONICAL_TYPE_ALIASES[canonicalToken] : undefined;
    const legacyType = normalizeLegacyType(row.type);

    if (canonicalType) {
        return {
            type: canonicalType,
            inferred: false,
            conflict: Boolean(legacyType && legacyType !== canonicalType),
        };
    }
    if (legacyType) return { type: legacyType, inferred: false, conflict: false };

    return {
        type: options.length >= 2 ? QuestionType.MCQ : QuestionType.SHORT_ANSWER,
        inferred: true,
        conflict: false,
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
        const correct = normalizeBoolean(item.isCorrect ?? item.correct_answer ?? item.answer);
        if (!statement || correct === null) return [];
        return [{
            id: text(item.id) || createId('import-json-tf-item'),
            statement,
            isCorrect: correct,
        }];
    });
};

const normalizeMatchingData = (row: JsonRecord) => {
    const invalidReferences: string[] = [];
    if (Array.isArray(row.pairs)) {
        const pairs = row.pairs.flatMap((pair, index) => {
            if (!isRecord(pair)) {
                invalidReferences.push(`pair-${index + 1}`);
                return [];
            }
            const left = text(pair.left);
            const right = text(pair.right);
            if (!left || !right) {
                invalidReferences.push(`pair-${index + 1}`);
                return [];
            }
            return [{ left, right }];
        });
        return { pairs, invalidReferences };
    }

    if (!Array.isArray(row.left_items) || !Array.isArray(row.right_items) || !Array.isArray(row.matches)) {
        return { pairs: [], invalidReferences: ['missing-matching-data'] };
    }
    const leftById = new Map<string, string>();
    const rightById = new Map<string, string>();
    row.left_items.forEach((item) => {
        if (!isRecord(item)) return;
        const id = text(item.id);
        const value = firstText(item, ['text', 'label', 'value', 'content']);
        if (id && value) leftById.set(id, value);
    });
    row.right_items.forEach((item) => {
        if (!isRecord(item)) return;
        const id = text(item.id);
        const value = firstText(item, ['text', 'label', 'value', 'content']);
        if (id && value) rightById.set(id, value);
    });
    const pairs = row.matches.flatMap((match, index) => {
        if (!isRecord(match)) {
            invalidReferences.push(`match-${index + 1}`);
            return [];
        }
        const leftId = text(match.left);
        const rightId = text(match.right);
        const left = leftById.get(leftId);
        const right = rightById.get(rightId);
        if (!left || !right) {
            invalidReferences.push(leftId || rightId || `match-${index + 1}`);
            return [];
        }
        return [{ left, right }];
    });
    return { pairs, invalidReferences };
};
const normalizeStringItems = (value: unknown): Array<{ id: string; text: string }> => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item, index) => {
        if (isRecord(item)) {
            const itemText = firstText(item, ['text', 'label', 'value', 'content']);
            if (!itemText) return [];
            return [{ id: text(item.id) || `item-${index + 1}`, text: itemText }];
        }
        const itemText = text(item);
        return itemText ? [{ id: `item-${index + 1}`, text: itemText }] : [];
    });
};

const replaceCanonicalPlaceholders = (value: unknown): string => text(value).replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (_match, token: string) => `[${token.trim()}]`,
);

const normalizeDragDropData = (row: JsonRecord) => {
    const dragItems = normalizeStringItems(row.drag_items);
    const itemTextById = new Map(dragItems.map((item) => [item.id, item.text]));
    const usedItemIds = new Set<string>();
    const invalidReferences: string[] = [];
    const blanks = Array.isArray(row.answers) ? row.answers.flatMap((answer) => {
        if (!isRecord(answer)) return [];
        const blankId = text(answer.blank);
        const itemId = text(answer.item);
        const correctAnswer = itemTextById.get(itemId);
        if (!blankId || !correctAnswer) {
            invalidReferences.push(blankId || itemId || 'unknown');
            return [];
        }
        usedItemIds.add(itemId);
        return [{ id: blankId, correctAnswer }];
    }) : [];
    return {
        text: replaceCanonicalPlaceholders(row.content ?? row.text),
        blanks,
        distractors: dragItems.filter((item) => !usedItemIds.has(item.id)).map((item) => item.text),
        invalidReferences,
    };
};

const normalizeOrderingData = (row: JsonRecord) => {
    const items = normalizeStringItems(row.items);
    const indexById = new Map(items.map((item, index) => [item.id, index]));
    const rawOrder = Array.isArray(row.correct_order)
        ? row.correct_order
        : Array.isArray(row.correctOrder)
            ? row.correctOrder
            : [];
    const invalidReferences: string[] = [];
    const correctOrder = rawOrder.flatMap((entry) => {
        if (typeof entry === 'number' && Number.isInteger(entry) && entry >= 0 && entry < items.length) return [entry];
        const id = text(entry);
        const index = indexById.get(id);
        if (index === undefined) {
            invalidReferences.push(id || String(entry));
            return [];
        }
        return [index];
    });
    return { items: items.map((item) => item.text), correctOrder, invalidReferences };
};

const normalizeDropdownData = (row: JsonRecord) => {
    const invalidBlanks: string[] = [];
    const blanks = Array.isArray(row.dropdowns) ? row.dropdowns.flatMap((blank, index) => {
        if (!isRecord(blank)) return [];
        const id = text(blank.id) || `select${index + 1}`;
        const options = normalizeOptions(blank.options);
        const correctAnswer = text(blank.correctAnswer ?? blank.correct_answer ?? blank.answer);
        if (options.length < 2 || !correctAnswer || !options.includes(correctAnswer)) invalidBlanks.push(id);
        return [{ id, options, correctAnswer }];
    }) : [];
    return {
        text: replaceCanonicalPlaceholders(row.content ?? row.text),
        blanks,
        invalidBlanks,
    };
};

const normalizeUnderlineToken = (value: string): string => value
    .trim()
    .toLocaleLowerCase('vi')
    .replace(/^[.,!?;:"'“”‘’()[\]{}]+|[.,!?;:"'“”‘’()[\]{}]+$/g, '');

const normalizeUnderlineData = (row: JsonRecord) => {
    const sentence = firstText(row, ['content', 'sentence']);
    const words = sentence ? sentence.split(/\s+/).filter(Boolean) : [];
    const parts = normalizeStringItems(row.selectable_parts);
    const wordIndexByPartId = new Map<string, number>();
    const invalidReferences: string[] = [];

    parts.forEach((part) => {
        if (/\s/.test(part.text.trim())) {
            invalidReferences.push(part.id);
            return;
        }
        const target = normalizeUnderlineToken(part.text);
        const matches = words.flatMap((word, index) => (
            normalizeUnderlineToken(word) === target ? [index] : []
        ));
        if (!target || matches.length !== 1) {
            invalidReferences.push(part.id);
            return;
        }
        wordIndexByPartId.set(part.id, matches[0]);
    });

    const rawAnswers = Array.isArray(row.correct_answers)
        ? row.correct_answers
        : Array.isArray(row.correctAnswers)
            ? row.correctAnswers
            : [];
    const correctWordIndexes = Array.from(new Set(rawAnswers.flatMap((entry) => {
        const id = text(entry);
        const index = wordIndexByPartId.get(id);
        if (index === undefined) {
            invalidReferences.push(id);
            return [];
        }
        return [index];
    }))).sort((left, right) => left - right);

    return {
        sentence,
        words,
        correctWordIndexes,
        invalidReferences,
    };
};
const normalizeCategorizationData = (row: JsonRecord) => {
    const categories = Array.isArray(row.groups) ? row.groups.flatMap((group) => {
        if (!isRecord(group)) return [];
        const id = text(group.id);
        const name = firstText(group, ['name', 'text', 'label']);
        return id && name ? [{ id, name }] : [];
    }) : [];
    const categoryIds = new Set(categories.map((category) => category.id));
    const assignmentByItemId = new Map<string, string>();
    const invalidReferences: string[] = [];
    if (Array.isArray(row.answers)) {
        row.answers.forEach((answer) => {
            if (!isRecord(answer)) return;
            const itemId = text(answer.item);
            const groupId = text(answer.group);
            if (!itemId || !categoryIds.has(groupId)) {
                invalidReferences.push(itemId || groupId || 'unknown');
                return;
            }
            assignmentByItemId.set(itemId, groupId);
        });
    }
    const items = Array.isArray(row.items) ? row.items.flatMap((item) => {
        if (!isRecord(item)) return [];
        const id = text(item.id);
        const content = firstText(item, ['text', 'content', 'label', 'value']);
        const categoryId = assignmentByItemId.get(id) ?? text(item.categoryId ?? item.category_id);
        if (!id || !content || !categoryIds.has(categoryId)) {
            invalidReferences.push(id || categoryId || 'unknown');
            return [];
        }
        return [{ id, content, categoryId }];
    }) : [];
    return { categories, items, invalidReferences };
};

const normalizeWordAssemblyData = (row: JsonRecord) => {
    const parts = normalizeStringItems(row.parts ?? row.letters);
    const ordering = normalizeOrderingData({ ...row, items: row.parts ?? row.items });
    const isCharacterAssembly = parts.length >= 2
        && parts.every((part) => Array.from(part.text).length === 1);
    const derivedCorrectText = ordering.correctOrder
        .map((index) => parts[index]?.text ?? '')
        .filter(Boolean)
        .join(isCharacterAssembly ? '' : ' ');
    const correctWord = firstText(row, ['correct_text', 'correctWord', 'correct_word']) || derivedCorrectText;
    return {
        letters: parts.map((part) => part.text),
        correctWord,
        isCharacterAssembly,
        ordering,
    };
};

const normalizeRiddleLines = (row: JsonRecord): string[] => {
    if (Array.isArray(row.riddleLines)) return row.riddleLines.map(text).filter(Boolean);
    const riddle = text(row.riddle);
    return riddle ? riddle.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
};
const normalizeAcceptedAnswer = (row: JsonRecord): unknown => {
    if (Array.isArray(row.accepted_answers)) {
        return row.accepted_answers.map(text).filter(Boolean).join('|');
    }
    return row.correctAnswers
        ?? row.correct_answers
        ?? row.correctAnswer
        ?? row.correct_answer
        ?? row.answer;
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
    image: firstText(row, ['image', 'image_url', 'imageUrl']) || undefined,
    imageAlt: firstText(row, ['imageAlt', 'image_alt', 'image_description']) || undefined,
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
    const normalizedType = normalizeQuestionType(raw, options);
    const prompt = firstText(raw, ['question', 'questionText', 'text', 'mainQuestion'])
        || (normalizedType.type === QuestionType.RIDDLE ? 'Em hãy giải câu đố sau.' : '');
    const rawAnswer = normalizeAcceptedAnswer(raw);
    const issues: string[] = [];
    let status: QuestionImportStatus = 'accepted';
    const rawQuestionRichText = raw.questionRichText ?? raw.question_rich_text;
    const parsedQuestionRichText = rawQuestionRichText === undefined || rawQuestionRichText === null || rawQuestionRichText === ''
        ? undefined
        : parseQuestionRichText(rawQuestionRichText);
    const questionRichText = parsedQuestionRichText?.ok ? parsedQuestionRichText.value : undefined;

    if (!prompt) {
        issues.push('Thiếu nội dung câu hỏi.');
        status = 'rejected';
    }

    if (normalizedType.inferred) {
        issues.push('Loại câu hỏi chưa được nhận diện; hệ thống đã tạm suy đoán.');
        if (status !== 'rejected') status = 'needsReview';
    }
    if (normalizedType.conflict) {
        issues.push('question_type và type đang mô tả hai loại câu hỏi khác nhau; hệ thống ưu tiên question_type.');
        if (status !== 'rejected') status = 'needsReview';
    }
    if (parsedQuestionRichText && parsedQuestionRichText.ok === false) {
        issues.push(`questionRichText không hợp lệ: ${parsedQuestionRichText.error}`);
        if (status !== 'rejected') status = 'needsReview';
    }

    const base = createBaseQuestion(raw);
    let question: ImportedManualQuizQuestion;

    if (normalizedType.type === QuestionType.IMAGE_QUESTION) {
        const correctAnswer = normalizeSingleChoiceAnswer(rawAnswer, options);
        if (!base.image) {
            issues.push('Câu hình ảnh cần có ảnh/media thật; image_description chỉ là mô tả hỗ trợ.');
            if (status !== 'rejected') status = 'needsReview';
        }
        if (options.length < 2 || !correctAnswer || !/^[A-Z]$/.test(correctAnswer) || options[correctAnswer.charCodeAt(0) - 65] === undefined) {
            issues.push('Câu hình ảnh cần ít nhất hai phương án và đáp án đúng khớp với options.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.IMAGE_QUESTION,
            question: prompt,
            options,
            correctAnswer,
        } as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.CATEGORIZATION) {
        const data = normalizeCategorizationData(raw);
        if (data.categories.length < 2 || data.items.length === 0 || data.invalidReferences.length > 0) {
            issues.push('Câu phân loại cần ít nhất hai nhóm và mọi item phải tham chiếu một nhóm hợp lệ.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.CATEGORIZATION,
            question: prompt,
            categories: data.categories,
            items: data.items,
        } as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.WORD_SCRAMBLE) {
        const data = normalizeWordAssemblyData(raw);
        if (data.isCharacterAssembly) {
            if (!data.correctWord) {
                issues.push('Câu ghép chữ cần có đáp án đúng.');
                if (status !== 'rejected') status = 'needsReview';
            }
            question = {
                ...base,
                type: QuestionType.WORD_SCRAMBLE,
                question: prompt,
                letters: data.letters,
                correctWord: data.correctWord,
                hint: text(raw.hint) || undefined,
            } as ManualQuizQuestion;
        } else {
            const validOrder = data.ordering.items.length >= 2
                && data.ordering.correctOrder.length === data.ordering.items.length
                && new Set(data.ordering.correctOrder).size === data.ordering.items.length
                && data.ordering.invalidReferences.length === 0;
            if (!validOrder) {
                issues.push('Câu ghép từ thành câu cần correct_order tham chiếu đủ mỗi phần đúng một lần.');
                if (status !== 'rejected') status = 'needsReview';
            }
            question = {
                ...base,
                type: QuestionType.ORDERING,
                question: prompt,
                items: data.ordering.items,
                correctOrder: data.ordering.correctOrder,
            } as ManualQuizQuestion;
        }
    } else if (normalizedType.type === QuestionType.RIDDLE) {
        const riddleLines = normalizeRiddleLines(raw);
        const correctAnswer = text(rawAnswer);
        if (riddleLines.length === 0 || !correctAnswer) {
            issues.push('Câu đố cần có nội dung câu đố và ít nhất một đáp án hợp lệ.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.RIDDLE,
            question: prompt,
            riddleLines,
            correctAnswer,
            answerType: 'original',
            answerLabel: firstText(raw, ['answerLabel', 'answer_label']) || 'Đáp án',
            hint: text(raw.hint) || undefined,
        } as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.DRAG_DROP) {
        const data = normalizeDragDropData(raw);
        if (!data.text || data.blanks.length === 0 || data.invalidReferences.length > 0) {
            issues.push('Câu kéo-thả cần nội dung, các chỗ trống và đáp án tham chiếu hợp lệ.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.DRAG_DROP,
            question: prompt,
            text: data.text,
            blanks: data.blanks,
            distractors: data.distractors,
        } as unknown as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.ORDERING) {
        const data = normalizeOrderingData(raw);
        const validOrder = data.items.length >= 2
            && data.correctOrder.length === data.items.length
            && new Set(data.correctOrder).size === data.items.length
            && data.invalidReferences.length === 0;
        if (!validOrder) {
            issues.push('Câu sắp xếp cần đủ item và correct_order hợp lệ, không thiếu hoặc lặp item.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.ORDERING,
            question: prompt,
            items: data.items,
            correctOrder: data.correctOrder,
        } as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.DROPDOWN) {
        const data = normalizeDropdownData(raw);
        if (!data.text || data.blanks.length === 0 || data.invalidBlanks.length > 0) {
            issues.push('Câu chọn từ danh sách cần nội dung và mỗi danh sách phải có đáp án đúng nằm trong options.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.DROPDOWN,
            question: prompt,
            text: data.text,
            blanks: data.blanks,
        } as ManualQuizQuestion;
    } else if (normalizedType.type === QuestionType.UNDERLINE) {
        const data = normalizeUnderlineData(raw);
        if (!data.sentence || data.words.length === 0 || data.correctWordIndexes.length === 0 || data.invalidReferences.length > 0) {
            issues.push('Câu gạch chân cần ngữ liệu, phần có thể chọn và đáp án tham chiếu hợp lệ.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            type: QuestionType.UNDERLINE,
            question: prompt,
            sentence: data.sentence,
            words: data.words,
            correctWordIndexes: data.correctWordIndexes,
        } as ManualQuizQuestion;
    } else     if (normalizedType.type === QuestionType.TRUE_FALSE) {
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
        const matching = normalizeMatchingData(raw);
        const pairs = matching.pairs;
        if (pairs.length === 0 || matching.invalidReferences.length > 0) {
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

    if (questionRichText) {
        question = { ...question, questionRichText };
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
