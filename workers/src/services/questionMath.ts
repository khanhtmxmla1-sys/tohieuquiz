import {
    analyzeMathText,
    hasMathSyntax,
    normalizeMathText,
    type MathSyntaxIssue,
} from '../../../src/utils/mathText';
import {
    normalizeQuestionMath,
    validateQuestionMath,
    type QuestionMathIssue,
} from '../../../src/utils/questionMath';

export const CURRENT_MATH_FORMAT_VERSION = 2;

export const PERSISTED_MATH_COLUMNS = [
    'question',
    'options',
    'correct_answer',
    'items',
    'text_field',
    'blanks',
    'distractors',
    'sentence',
    'words',
    'correct_word_indexes',
] as const;

export type PersistedMathColumn = typeof PERSISTED_MATH_COLUMNS[number];
export type PersistedQuestionRow = Record<string, unknown> & {
    id: string;
    quiz_id: string;
    type: string;
    math_format_version?: number | string | null;
};

export interface PersistedMathIssue extends MathSyntaxIssue {
    field: string;
}

export class QuestionMathValidationError extends Error {
    readonly issues: QuestionMathIssue[];

    constructor(issues: QuestionMathIssue[]) {
        super('Question contains invalid mathematical notation');
        this.name = 'QuestionMathValidationError';
        this.issues = issues;
    }
}

export interface PersistedQuestionAudit {
    normalized: PersistedQuestionRow;
    currentIssues: PersistedMathIssue[];
    remainingIssues: PersistedMathIssue[];
    changedFields: PersistedMathColumn[];
    currentVersion: number;
    needsUpgrade: boolean;
    previewBefore: string;
    previewAfter: string;
}

const DIRECT_TEXT_COLUMNS = new Set<PersistedMathColumn>([
    'question',
    'correct_answer',
    'text_field',
    'sentence',
]);

const JSON_COLUMNS = new Set<PersistedMathColumn>([
    'items',
    'blanks',
    'distractors',
    'words',
    'correct_word_indexes',
]);

const normalizeString = (value: unknown): string => {
    const text = String(value ?? '');
    return hasMathSyntax(text) ? normalizeMathText(text) : text;
};

const normalizeNested = (value: unknown): unknown => {
    if (typeof value === 'string') return normalizeString(value);
    if (Array.isArray(value)) return value.map(normalizeNested);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([key, child]) => [key, normalizeNested(child)]),
    );
};

const collectNestedIssues = (
    value: unknown,
    path: string,
    output: PersistedMathIssue[],
): void => {
    if (typeof value === 'string') {
        if (!hasMathSyntax(value)) return;
        for (const issue of analyzeMathText(value)) output.push({ ...issue, field: path });
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((child, index) => collectNestedIssues(child, `${path}[${index}]`, output));
        return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        collectNestedIssues(child, `${path}.${key}`, output);
    }
};

const normalizeJsonLike = (rawValue: unknown): string => {
    const raw = String(rawValue ?? '');
    if (!raw.trim()) return raw;
    try {
        return JSON.stringify(normalizeNested(JSON.parse(raw)));
    } catch {
        return normalizeString(raw);
    }
};

const analyzeJsonLike = (
    rawValue: unknown,
    field: string,
    output: PersistedMathIssue[],
): void => {
    const raw = String(rawValue ?? '');
    if (!raw.trim()) return;
    try {
        collectNestedIssues(JSON.parse(raw), field, output);
    } catch {
        if (!hasMathSyntax(raw)) return;
        for (const issue of analyzeMathText(raw)) output.push({ ...issue, field });
    }
};

const normalizeColumn = (column: PersistedMathColumn, value: unknown): string => {
    if (column === 'options') {
        return String(value ?? '')
            .split('|')
            .map(normalizeString)
            .join('|');
    }
    if (JSON_COLUMNS.has(column)) return normalizeJsonLike(value);
    return normalizeString(value);
};

const analyzeColumn = (
    column: PersistedMathColumn,
    value: unknown,
    output: PersistedMathIssue[],
): void => {
    if (column === 'options') {
        String(value ?? '').split('|').forEach((option, index) => {
            if (!hasMathSyntax(option)) return;
            for (const issue of analyzeMathText(option)) {
                output.push({ ...issue, field: `options[${index}]` });
            }
        });
        return;
    }
    if (JSON_COLUMNS.has(column)) {
        analyzeJsonLike(value, column, output);
        return;
    }
    const text = String(value ?? '');
    if (!hasMathSyntax(text)) return;
    for (const issue of analyzeMathText(text)) output.push({ ...issue, field: column });
};

const getPreviewValue = (row: PersistedQuestionRow, preferredFields: string[]): string => {
    for (const candidate of preferredFields) {
        const root = candidate.replace(/\[.*$/, '').split('.')[0] as PersistedMathColumn;
        const raw = String(row[root] ?? '');
        if (!raw) continue;
        if (root === 'options') return raw.split('|')[0] || raw;
        if (JSON_COLUMNS.has(root)) {
            try {
                const parsed = JSON.parse(raw);
                const values: string[] = [];
                const visit = (value: unknown) => {
                    if (typeof value === 'string') values.push(value);
                    else if (Array.isArray(value)) value.forEach(visit);
                    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(visit);
                };
                visit(parsed);
                if (values[0]) return values[0];
            } catch {
                return raw;
            }
        }
        return raw;
    }
    return String(row.question ?? row.text_field ?? row.sentence ?? '');
};

export const normalizeIncomingQuestion = <T>(question: T): {
    normalized: T;
    issues: QuestionMathIssue[];
} => {
    const normalized = normalizeQuestionMath(question);
    return { normalized, issues: validateQuestionMath(normalized) };
};

export const prepareIncomingQuestion = <T>(question: T): T => {
    const result = normalizeIncomingQuestion(question);
    if (result.issues.length > 0) throw new QuestionMathValidationError(result.issues);
    return result.normalized;
};

export const normalizePersistedQuestionRow = (
    row: PersistedQuestionRow,
): PersistedQuestionRow => {
    const output: PersistedQuestionRow = { ...row };
    for (const column of PERSISTED_MATH_COLUMNS) {
        output[column] = normalizeColumn(column, row[column]);
    }
    output.math_format_version = CURRENT_MATH_FORMAT_VERSION;
    return output;
};

export const snapshotPersistedMath = (
    row: PersistedQuestionRow,
): Record<string, string | number> => {
    const snapshot: Record<string, string | number> = {};
    for (const column of PERSISTED_MATH_COLUMNS) snapshot[column] = String(row[column] ?? '');
    snapshot.math_format_version = Number(row.math_format_version || 1);
    return snapshot;
};

export const auditPersistedQuestionRow = (
    row: PersistedQuestionRow,
): PersistedQuestionAudit => {
    const currentIssues: PersistedMathIssue[] = [];
    for (const column of PERSISTED_MATH_COLUMNS) analyzeColumn(column, row[column], currentIssues);

    const normalized = normalizePersistedQuestionRow(row);
    const remainingIssues: PersistedMathIssue[] = [];
    for (const column of PERSISTED_MATH_COLUMNS) analyzeColumn(column, normalized[column], remainingIssues);

    const changedFields = PERSISTED_MATH_COLUMNS.filter(
        (column) => String(row[column] ?? '') !== String(normalized[column] ?? ''),
    );
    const currentVersion = Number(row.math_format_version || 1);
    const preferredFields = [
        ...currentIssues.map((issue) => issue.field),
        ...changedFields,
        'question',
        'text_field',
        'sentence',
    ];

    return {
        normalized,
        currentIssues,
        remainingIssues,
        changedFields,
        currentVersion,
        needsUpgrade: currentVersion < CURRENT_MATH_FORMAT_VERSION,
        previewBefore: getPreviewValue(row, preferredFields),
        previewAfter: getPreviewValue(normalized, preferredFields),
    };
};
