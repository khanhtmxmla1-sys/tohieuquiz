export const QUESTION_RICH_TEXT_SCHEMA_VERSION = 1 as const;
export const MAX_QUESTION_RICH_TEXT_BYTES = 64 * 1024;

export const QUESTION_TEXT_COLOR_PALETTE = [
    '#0F172A',
    '#0369A1',
    '#15803D',
    '#B45309',
    '#BE123C',
    '#6D28D9',
] as const;

export const QUESTION_HIGHLIGHT_PALETTE = [
    '#FEF3C7',
    '#DCFCE7',
    '#DBEAFE',
    '#FCE7F3',
    '#EDE9FE',
] as const;

export type QuestionTextAlign = 'left' | 'center' | 'right';
export type QuestionRichTextMarkType = 'bold' | 'italic' | 'underline' | 'strike' | 'textStyle' | 'highlight';
export type QuestionRichTextNodeType = 'doc' | 'paragraph' | 'text' | 'hardBreak' | 'bulletList' | 'orderedList' | 'listItem';

export interface QuestionRichTextMark {
    type: QuestionRichTextMarkType;
    attrs?: {
        color: string;
    };
}

export interface QuestionRichTextNode {
    type: QuestionRichTextNodeType;
    attrs?: {
        textAlign?: QuestionTextAlign;
        start?: number;
    };
    content?: QuestionRichTextNode[];
    text?: string;
    marks?: QuestionRichTextMark[];
}

export interface QuestionRichTextDoc extends QuestionRichTextNode {
    type: 'doc';
    content: QuestionRichTextNode[];
}

export interface QuestionRichTextEnvelopeV1 {
    schemaVersion: typeof QUESTION_RICH_TEXT_SCHEMA_VERSION;
    doc: QuestionRichTextDoc;
}

export type ParseQuestionRichTextResult =
    | { ok: true; value: QuestionRichTextEnvelopeV1 }
    | { ok: false; error: string };

const TEXT_COLORS = new Set<string>(QUESTION_TEXT_COLOR_PALETTE);
const HIGHLIGHT_COLORS = new Set<string>(QUESTION_HIGHLIGHT_PALETTE);
const TEXT_ALIGNMENTS = new Set<QuestionTextAlign>(['left', 'center', 'right']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
    Object.keys(value).every((key) => allowed.includes(key));

const byteLength = (value: unknown): number | null => {
    try {
        return new TextEncoder().encode(JSON.stringify(value)).byteLength;
    } catch {
        return null;
    }
};

const validateMark = (input: unknown, path: string): string | null => {
    if (!isPlainObject(input) || typeof input.type !== 'string') return `${path}: mark không hợp lệ.`;
    if (!hasOnlyKeys(input, ['type', 'attrs'])) return `${path}: mark chứa thuộc tính không được hỗ trợ.`;

    if (input.type === 'bold' || input.type === 'italic' || input.type === 'underline' || input.type === 'strike') {
        if (input.attrs !== undefined) return `${path}: mark ${input.type} không nhận attrs.`;
        return null;
    }

    if (input.type !== 'textStyle' && input.type !== 'highlight') {
        return `${path}: mark ${input.type} không được hỗ trợ.`;
    }
    if (!isPlainObject(input.attrs) || !hasOnlyKeys(input.attrs, ['color']) || typeof input.attrs.color !== 'string') {
        return `${path}: mark ${input.type} yêu cầu màu hợp lệ.`;
    }

    const palette = input.type === 'textStyle' ? TEXT_COLORS : HIGHLIGHT_COLORS;
    if (!palette.has(input.attrs.color)) return `${path}: màu ngoài palette hệ thống.`;
    return null;
};

const validateContentArray = (
    content: unknown,
    path: string,
    allowedTypes: ReadonlySet<QuestionRichTextNodeType>,
): string | null => {
    if (content === undefined) return null;
    if (!Array.isArray(content)) return `${path}: content phải là mảng.`;
    for (let index = 0; index < content.length; index += 1) {
        const child = content[index];
        if (!isPlainObject(child) || typeof child.type !== 'string' || !allowedTypes.has(child.type as QuestionRichTextNodeType)) {
            return `${path}[${index}]: node không được hỗ trợ.`;
        }
        const issue = validateNode(child, `${path}[${index}]`);
        if (issue) return issue;
    }
    return null;
};

const validateNode = (input: unknown, path: string): string | null => {
    if (!isPlainObject(input) || typeof input.type !== 'string') return `${path}: node không hợp lệ.`;
    if (!['doc', 'paragraph', 'text', 'hardBreak', 'bulletList', 'orderedList', 'listItem'].includes(input.type)) {
        return `${path}: node ${input.type} không được hỗ trợ.`;
    }

    switch (input.type) {
        case 'doc': {
            if (!hasOnlyKeys(input, ['type', 'content'])) return `${path}: doc chứa thuộc tính không được hỗ trợ.`;
            if (!Array.isArray(input.content)) return `${path}: doc.content phải là mảng.`;
            return validateContentArray(input.content, `${path}.content`, new Set(['paragraph', 'bulletList', 'orderedList']));
        }
        case 'paragraph': {
            if (!hasOnlyKeys(input, ['type', 'attrs', 'content'])) return `${path}: paragraph chứa thuộc tính không được hỗ trợ.`;
            if (input.attrs !== undefined) {
                if (!isPlainObject(input.attrs) || !hasOnlyKeys(input.attrs, ['textAlign'])) {
                    return `${path}: paragraph attrs không hợp lệ.`;
                }
                if (input.attrs.textAlign !== undefined
                    && (typeof input.attrs.textAlign !== 'string' || !TEXT_ALIGNMENTS.has(input.attrs.textAlign as QuestionTextAlign))) {
                    return `${path}: textAlign không được hỗ trợ.`;
                }
            }
            return validateContentArray(input.content, `${path}.content`, new Set(['text', 'hardBreak']));
        }
        case 'text': {
            if (!hasOnlyKeys(input, ['type', 'text', 'marks'])) return `${path}: text chứa thuộc tính không được hỗ trợ.`;
            if (typeof input.text !== 'string') return `${path}: text phải là chuỗi.`;
            if (input.marks !== undefined) {
                if (!Array.isArray(input.marks)) return `${path}: marks phải là mảng.`;
                for (let index = 0; index < input.marks.length; index += 1) {
                    const issue = validateMark(input.marks[index], `${path}.marks[${index}]`);
                    if (issue) return issue;
                }
            }
            return null;
        }
        case 'hardBreak':
            return hasOnlyKeys(input, ['type']) ? null : `${path}: hardBreak chứa thuộc tính không được hỗ trợ.`;
        case 'bulletList': {
            if (!hasOnlyKeys(input, ['type', 'content'])) return `${path}: bulletList chứa thuộc tính không được hỗ trợ.`;
            return validateContentArray(input.content, `${path}.content`, new Set(['listItem']));
        }
        case 'orderedList': {
            if (!hasOnlyKeys(input, ['type', 'attrs', 'content'])) return `${path}: orderedList chứa thuộc tính không được hỗ trợ.`;
            if (input.attrs !== undefined) {
                if (!isPlainObject(input.attrs) || !hasOnlyKeys(input.attrs, ['start'])) {
                    return `${path}: orderedList attrs không hợp lệ.`;
                }
                if (input.attrs.start !== undefined
                    && (!Number.isInteger(input.attrs.start) || Number(input.attrs.start) < 1 || Number(input.attrs.start) > 999)) {
                    return `${path}: orderedList.start không hợp lệ.`;
                }
            }
            return validateContentArray(input.content, `${path}.content`, new Set(['listItem']));
        }
        case 'listItem': {
            if (!hasOnlyKeys(input, ['type', 'content'])) return `${path}: listItem chứa thuộc tính không được hỗ trợ.`;
            return validateContentArray(input.content, `${path}.content`, new Set(['paragraph']));
        }
        default:
            return `${path}: node không được hỗ trợ.`;
    }
};

export const parseQuestionRichText = (input: unknown): ParseQuestionRichTextResult => {
    const size = byteLength(input);
    if (size === null) return { ok: false, error: 'Dữ liệu rich text không thể tuần tự hóa.' };
    if (size > MAX_QUESTION_RICH_TEXT_BYTES) {
        return { ok: false, error: `Dữ liệu rich text vượt quá ${MAX_QUESTION_RICH_TEXT_BYTES} byte.` };
    }
    if (!isPlainObject(input) || !hasOnlyKeys(input, ['schemaVersion', 'doc'])) {
        return { ok: false, error: 'Envelope rich text không hợp lệ.' };
    }
    if (input.schemaVersion !== QUESTION_RICH_TEXT_SCHEMA_VERSION) {
        return { ok: false, error: 'Phiên bản rich text chưa được hỗ trợ.' };
    }
    const issue = validateNode(input.doc, 'doc');
    if (issue) return { ok: false, error: issue };
    if (!isPlainObject(input.doc) || input.doc.type !== 'doc' || !Array.isArray(input.doc.content)) {
        return { ok: false, error: 'Rich text doc không hợp lệ.' };
    }
    return { ok: true, value: input as unknown as QuestionRichTextEnvelopeV1 };
};

const renderNodePlainText = (node: QuestionRichTextNode): string => {
    switch (node.type) {
        case 'text':
            return node.text ?? '';
        case 'hardBreak':
            return '\n';
        case 'paragraph':
            return (node.content ?? []).map(renderNodePlainText).join('');
        case 'listItem':
            return (node.content ?? []).map(renderNodePlainText).join('\n');
        case 'bulletList':
        case 'orderedList':
            return (node.content ?? []).map(renderNodePlainText).join('\n');
        case 'doc':
            return (node.content ?? []).map(renderNodePlainText).join('\n');
        default:
            return '';
    }
};

export const richTextToPlainText = (value: QuestionRichTextEnvelopeV1): string =>
    renderNodePlainText(value.doc);

export const plainTextToRichText = (value: string): QuestionRichTextEnvelopeV1 => {
    const normalized = String(value ?? '').replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    return {
        schemaVersion: QUESTION_RICH_TEXT_SCHEMA_VERSION,
        doc: {
            type: 'doc',
            content: lines.map((line) => ({
                type: 'paragraph',
                ...(line.length > 0 ? { content: [{ type: 'text', text: line }] } : {}),
            })),
        },
    };
};

export const serializeQuestionRichText = (value: QuestionRichTextEnvelopeV1 | undefined): string => {
    if (!value) return '';
    const parsed = parseQuestionRichText(value);
    return parsed.ok ? JSON.stringify(parsed.value) : '';
};

export const deserializeQuestionRichText = (input: unknown): QuestionRichTextEnvelopeV1 | undefined => {
    if (input === undefined || input === null || input === '') return undefined;
    let parsedInput = input;
    if (typeof input === 'string') {
        try {
            parsedInput = JSON.parse(input);
        } catch {
            return undefined;
        }
    }
    const parsed = parseQuestionRichText(parsedInput);
    return parsed.ok ? parsed.value : undefined;
};
