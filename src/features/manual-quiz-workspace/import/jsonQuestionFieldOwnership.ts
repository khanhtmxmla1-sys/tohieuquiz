import { QuestionType } from '../../../types';

type JsonRecord = Record<string, unknown>;

export interface JsonQuestionFieldOwnershipInput {
    type: QuestionType;
    row: JsonRecord;
    question: string;
    questionRichTextPlainText?: string;
}

export interface JsonQuestionFieldOwnershipResult {
    issues: string[];
    richTextViolatesOwnership: boolean;
}

const normalizeComparableText = (value: unknown): string => String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, '{{$1}}')
    .replace(/\s+/g, ' ')
    .trim();

const textFromRecord = (value: unknown, keys: string[]): string => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    const record = value as JsonRecord;
    for (const key of keys) {
        const candidate = String(record[key] ?? '').trim();
        if (candidate) return candidate;
    }
    return '';
};

const stringItems = (value: unknown, keys: string[] = ['text', 'label', 'value', 'content']): string[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
            const candidate = String(item).trim();
            return candidate ? [candidate] : [];
        }
        const candidate = textFromRecord(item, keys);
        return candidate ? [candidate] : [];
    });
};

const meaningfulFragments = (values: string[]): string[] => Array.from(new Set(
    values
        .map(normalizeComparableText)
        .filter((value) => value.length >= 4),
));

const containsOwnedBlock = (haystack: string, source: unknown): boolean => {
    const normalizedSource = normalizeComparableText(source);
    return normalizedSource.length >= 12 && haystack.includes(normalizedSource);
};

const containsStructuredPayload = (haystack: string, values: string[]): boolean => {
    const fragments = meaningfulFragments(values);
    if (fragments.length < 2) return false;
    const matched = fragments.filter((fragment) => haystack.includes(fragment)).length;
    return matched >= Math.max(2, Math.ceil(fragments.length * 0.8));
};

const containsExplicitChoiceList = (value: unknown, values: string[]): boolean => {
    const fragments = new Set(meaningfulFragments(values));
    if (fragments.size < 2) return false;

    const source = String(value ?? '').normalize('NFC');
    const segments = source.split(/\r?\n|;/).map((segment) => segment.trim()).filter(Boolean);
    const explicitMatches = new Set(segments.flatMap((segment) => {
        const match = segment.match(/^(?:(?:[A-Z]|\d+)[.)\-:]|[-*•])\s*(.+)$/iu);
        if (!match) return [];
        const normalized = normalizeComparableText(match[1]);
        return fragments.has(normalized) ? [normalized] : [];
    }));
    if (explicitMatches.size >= 2) return true;

    const announcesChoices = /(?:phương án|đáp án|lựa chọn|options?)\s*:/iu.test(source);
    if (!announcesChoices) return false;
    const announcedMatches = new Set(
        segments
            .map(normalizeComparableText)
            .filter((segment) => fragments.has(segment)),
    );
    return announcedMatches.size >= 2;
};

const canonicalTypeLabel = (type: QuestionType): string => {
    switch (type) {
        case QuestionType.MCQ: return 'SINGLE_CHOICE';
        case QuestionType.TRUE_FALSE: return 'TRUE_FALSE';
        case QuestionType.SHORT_ANSWER: return 'SHORT_ANSWER';
        case QuestionType.MATCHING: return 'MATCHING';
        case QuestionType.MULTIPLE_SELECT: return 'MULTIPLE_CHOICE';
        case QuestionType.DRAG_DROP: return 'DRAG_DROP_FILL';
        case QuestionType.ORDERING: return 'ORDERING';
        case QuestionType.IMAGE_QUESTION: return 'IMAGE_QUESTION';
        case QuestionType.DROPDOWN: return 'DROPDOWN';
        case QuestionType.UNDERLINE: return 'UNDERLINE';
        case QuestionType.CATEGORIZATION: return 'CATEGORIZATION';
        case QuestionType.WORD_SCRAMBLE: return 'WORD_ASSEMBLY';
        case QuestionType.RIDDLE: return 'RIDDLE';
        default: return String(type);
    }
};

const structuredPayloadForType = (type: QuestionType, row: JsonRecord): { owner: string; values: string[] } | undefined => {
    switch (type) {
        case QuestionType.MCQ:
        case QuestionType.MULTIPLE_SELECT:
        case QuestionType.IMAGE_QUESTION:
            return { owner: 'options', values: stringItems(row.options) };
        case QuestionType.TRUE_FALSE:
            return { owner: 'items', values: stringItems(row.items, ['statement', 'text', 'content']) };
        case QuestionType.MATCHING: {
            if (Array.isArray(row.pairs)) {
                const values = row.pairs.flatMap((pair) => [
                    textFromRecord(pair, ['left']),
                    textFromRecord(pair, ['right']),
                ]).filter(Boolean);
                return { owner: 'pairs', values };
            }
            return {
                owner: 'left_items/right_items',
                values: [
                    ...stringItems(row.left_items),
                    ...stringItems(row.right_items),
                ],
            };
        }
        case QuestionType.ORDERING:
            return { owner: 'items', values: stringItems(row.items) };
        case QuestionType.CATEGORIZATION:
            return {
                owner: 'groups/items',
                values: [
                    ...stringItems(row.groups, ['name', 'text', 'label']),
                    ...stringItems(row.items),
                ],
            };
        case QuestionType.WORD_SCRAMBLE:
            return { owner: 'parts', values: stringItems(row.parts ?? row.letters ?? row.items) };
        default:
            return undefined;
    }
};

const contentOwnedSource = (type: QuestionType, row: JsonRecord): { owner: string; source: unknown } | undefined => {
    switch (type) {
        case QuestionType.DRAG_DROP:
        case QuestionType.DROPDOWN:
        case QuestionType.UNDERLINE:
            return { owner: 'content', source: row.content ?? row.sentence ?? row.text };
        case QuestionType.RIDDLE:
            return {
                owner: 'riddle',
                source: row.riddle ?? (Array.isArray(row.riddleLines) ? row.riddleLines.join('\n') : ''),
            };
        default:
            return undefined;
    }
};

const inspectSurface = (
    surface: 'question' | 'questionRichText',
    value: string,
    type: QuestionType,
    row: JsonRecord,
): string[] => {
    const normalizedValue = normalizeComparableText(value);
    if (!normalizedValue) return [];
    const typeLabel = canonicalTypeLabel(type);
    const issues: string[] = [];

    if (type === QuestionType.DROPDOWN && /\{\{\s*select[^{}]*\}\}/i.test(normalizedValue)) {
        issues.push(`Câu ${typeLabel} đang đưa {{select...}} vào ${surface}; hãy để ${surface} chỉ chứa yêu cầu và ngữ liệu tương tác trong content.`);
    }
    if (type === QuestionType.DRAG_DROP && /\{\{\s*blank[^{}]*\}\}/i.test(normalizedValue)) {
        issues.push(`Câu ${typeLabel} đang đưa {{blank...}} vào ${surface}; hãy để ${surface} chỉ chứa yêu cầu và ngữ liệu kéo-thả trong content.`);
    }

    const ownedSource = contentOwnedSource(type, row);
    if (ownedSource && containsOwnedBlock(normalizedValue, ownedSource.source)) {
        issues.push(`Câu ${typeLabel} đang chép ngữ liệu ${ownedSource.owner} vào ${surface}; hãy giữ dữ liệu đó trong ${ownedSource.owner}.`);
    }

    const structuredPayload = structuredPayloadForType(type, row);
    const isChoicePayload = type === QuestionType.MCQ
        || type === QuestionType.MULTIPLE_SELECT
        || type === QuestionType.IMAGE_QUESTION;
    const copiesStructuredPayload = structuredPayload && (isChoicePayload
        ? containsExplicitChoiceList(value, structuredPayload.values)
        : containsStructuredPayload(normalizedValue, structuredPayload.values));
    if (structuredPayload && copiesStructuredPayload) {
        issues.push(`Câu ${typeLabel} đang chép dữ liệu ${structuredPayload.owner} vào ${surface}; hãy giữ dữ liệu cấu trúc trong ${structuredPayload.owner}.`);
    }

    return Array.from(new Set(issues));
};

export const detectJsonQuestionFieldOwnershipIssues = ({
    type,
    row,
    question,
    questionRichTextPlainText,
}: JsonQuestionFieldOwnershipInput): JsonQuestionFieldOwnershipResult => {
    const normalizedQuestion = normalizeComparableText(question);
    const normalizedRichText = normalizeComparableText(questionRichTextPlainText);
    const questionIssues = inspectSurface('question', question, type, row);
    const richIssues = questionRichTextPlainText
        ? inspectSurface('questionRichText', questionRichTextPlainText, type, row)
        : [];

    let richTextViolatesOwnership = richIssues.length > 0;
    if (questionRichTextPlainText && normalizedRichText !== normalizedQuestion) {
        richIssues.push('questionRichText không tương đương với question; rich text chỉ được định dạng đúng nội dung thuộc question.');
        richTextViolatesOwnership = true;
    }

    return {
        issues: Array.from(new Set([...questionIssues, ...richIssues])),
        richTextViolatesOwnership,
    };
};
