import { QuestionType } from '../../../types';
import {
    parseQuestionRichText,
    richTextToPlainText,
    type QuestionRichTextEnvelopeV1,
} from '../../../../shared/question-rich-text.contract';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import { detectJsonQuestionFieldOwnershipIssues } from './jsonQuestionFieldOwnership';
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
            question: 'Chọn đáp án đúng.\n2 + 3 bằng bao nhiêu?',
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
    const normalizedWords = words.map(normalizeUnderlineToken);
    const parts = normalizeStringItems(row.selectable_parts);
    const wordIndexesByPartId = new Map<string, number[]>();
    const invalidReferences: string[] = [];

    parts.forEach((part) => {
        const targetTokens = part.text
            .split(/\s+/)
            .map(normalizeUnderlineToken)
            .filter(Boolean);
        if (targetTokens.length === 0 || targetTokens.length > words.length) {
            invalidReferences.push(part.id);
            return;
        }

        const matchingSpans: number[][] = [];
        for (let start = 0; start <= normalizedWords.length - targetTokens.length; start += 1) {
            const matches = targetTokens.every((token, offset) => normalizedWords[start + offset] === token);
            if (matches) {
                matchingSpans.push(targetTokens.map((_token, offset) => start + offset));
            }
        }

        if (matchingSpans.length !== 1) {
            invalidReferences.push(part.id);
            return;
        }
        wordIndexesByPartId.set(part.id, matchingSpans[0]);
    });

    const rawAnswers = Array.isArray(row.correct_answers)
        ? row.correct_answers
        : Array.isArray(row.correctAnswers)
            ? row.correctAnswers
            : [];
    const correctWordIndexes = Array.from(new Set(rawAnswers.flatMap((entry) => {
        const id = text(entry);
        const indexes = wordIndexesByPartId.get(id);
        if (!indexes) {
            invalidReferences.push(id);
            return [];
        }
        return indexes;
    }))).sort((left, right) => left - right);

    return {
        sentence,
        words,
        correctWordIndexes,
        invalidReferences,
    };
};
const normalizeCategorizationData = (row: JsonRecord) => {
    const invalidReferences: string[] = [];
    const seenCategoryIds = new Set<string>();
    const categories = Array.isArray(row.groups) ? row.groups.flatMap((group, index) => {
        if (!isRecord(group)) {
            invalidReferences.push(`group-${index + 1}`);
            return [];
        }
        const id = text(group.id);
        const name = firstText(group, ['name', 'text', 'label']);
        if (!id || !name || seenCategoryIds.has(id)) {
            invalidReferences.push(id || `group-${index + 1}`);
            return [];
        }
        seenCategoryIds.add(id);
        return [{ id, name }];
    }) : [];
    const categoryIds = new Set(categories.map((category) => category.id));

    const seenItemIds = new Set<string>();
    const rawItems = Array.isArray(row.items) ? row.items.flatMap((item, index) => {
        if (!isRecord(item)) {
            invalidReferences.push(`item-${index + 1}`);
            return [];
        }
        const id = text(item.id);
        const content = firstText(item, ['text', 'content', 'label', 'value']);
        if (!id || !content || seenItemIds.has(id)) {
            invalidReferences.push(id || `item-${index + 1}`);
            return [];
        }
        seenItemIds.add(id);
        return [{
            id,
            content,
            inlineCategoryId: text(item.categoryId ?? item.category_id),
        }];
    }) : [];

    const assignmentByItemId = new Map<string, string>();
    if (Array.isArray(row.answers)) {
        row.answers.forEach((answer, index) => {
            if (!isRecord(answer)) {
                invalidReferences.push(`answer-${index + 1}`);
                return;
            }
            const itemId = text(answer.item);
            const groupId = text(answer.group);
            if (!seenItemIds.has(itemId) || !categoryIds.has(groupId) || assignmentByItemId.has(itemId)) {
                invalidReferences.push(itemId || groupId || `answer-${index + 1}`);
                return;
            }
            assignmentByItemId.set(itemId, groupId);
        });
    }

    const items = rawItems.flatMap((item) => {
        const assignedCategoryId = assignmentByItemId.get(item.id);
        if (assignedCategoryId && item.inlineCategoryId && assignedCategoryId !== item.inlineCategoryId) {
            invalidReferences.push(item.id);
            return [];
        }
        const categoryId = assignedCategoryId ?? item.inlineCategoryId;
        if (!categoryIds.has(categoryId)) {
            invalidReferences.push(item.id || categoryId || 'unknown');
            return [];
        }
        return [{ id: item.id, content: item.content, categoryId }];
    });
    return { categories, items, invalidReferences };
};

const normalizeWordAssemblyData = (row: JsonRecord) => {
    const sourceParts = row.parts ?? row.letters ?? row.items;
    const parts = normalizeStringItems(sourceParts);
    const ordering = normalizeOrderingData({ ...row, items: sourceParts });
    const isCharacterAssembly = parts.length >= 2
        && parts.every((part) => Array.from(part.text).length === 1);
    const validOrder = parts.length >= 2
        && ordering.correctOrder.length === parts.length
        && new Set(ordering.correctOrder).size === parts.length
        && ordering.invalidReferences.length === 0;
    const derivedCorrectText = validOrder
        ? ordering.correctOrder
            .map((index) => parts[index]?.text ?? '')
            .join(isCharacterAssembly ? '' : ' ')
        : '';
    const providedCorrectText = firstText(row, ['correct_text', 'correctWord', 'correct_word']);
    const normalizeComparableText = (value: string) => value.trim().replace(/\s+/g, ' ');
    const correctTextMatchesOrder = !providedCorrectText
        || !validOrder
        || normalizeComparableText(providedCorrectText) === normalizeComparableText(derivedCorrectText);
    const correctWord = validOrder && derivedCorrectText ? derivedCorrectText : providedCorrectText;
    return {
        letters: parts.map((part) => part.text),
        correctWord,
        isCharacterAssembly,
        ordering,
        validOrder,
        correctTextMatchesOrder,
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

const isUsableImportedImageSource = (value: string | undefined): boolean => {
    const source = value?.trim();
    if (!source || source.includes('...') || /<[^>]+>/.test(source)) return false;
    if (/^data:image\//i.test(source) || source.startsWith('/')) return true;
    try {
        const parsed = new URL(source);
        return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname);
    } catch {
        return false;
    }
};

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

    const ownership = detectJsonQuestionFieldOwnershipIssues({
        type: normalizedType.type,
        row: raw,
        question: prompt,
        questionRichTextPlainText: questionRichText ? richTextToPlainText(questionRichText) : undefined,
    });
    if (ownership.issues.length > 0) {
        issues.push(...ownership.issues);
        if (status !== 'rejected') status = 'needsReview';
    }

    const base = createBaseQuestion(raw);
    let question: ImportedManualQuizQuestion;

    if (normalizedType.type === QuestionType.IMAGE_QUESTION) {
        const correctAnswer = normalizeSingleChoiceAnswer(rawAnswer, options);
        const image = isUsableImportedImageSource(base.image) ? base.image : undefined;
        if (!image) {
            issues.push('Câu hình ảnh cần có ảnh/media hoặc image_url hợp lệ; image_description chỉ là mô tả hỗ trợ.');
            if (status !== 'rejected') status = 'needsReview';
        }
        if (options.length < 2 || !correctAnswer || !/^[A-Z]$/.test(correctAnswer) || options[correctAnswer.charCodeAt(0) - 65] === undefined) {
            issues.push('Câu hình ảnh cần ít nhất hai phương án và đáp án đúng khớp với options.');
            if (status !== 'rejected') status = 'needsReview';
        }
        question = {
            ...base,
            image,
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
            if (!data.validOrder) {
                issues.push('Câu ghép chữ cần correct_order tham chiếu đủ mỗi phần đúng một lần.');
                if (status !== 'rejected') status = 'needsReview';
            }
            if (!data.correctWord) {
                issues.push('Câu ghép chữ cần có đáp án đúng.');
                if (status !== 'rejected') status = 'needsReview';
            }
            if (!data.correctTextMatchesOrder) {
                issues.push('correct_text của câu ghép chữ không khớp với correct_order.');
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
            if (!data.validOrder) {
                issues.push('Câu ghép từ thành câu cần correct_order tham chiếu đủ mỗi phần đúng một lần.');
                if (status !== 'rejected') status = 'needsReview';
            }
            if (!data.correctTextMatchesOrder) {
                issues.push('correct_text của câu ghép từ thành câu không khớp với correct_order.');
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

    if (questionRichText && !ownership.richTextViolatesOwnership) {
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
