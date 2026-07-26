import {
    getMathTemplate,
    type MathTemplate,
    type MathTemplateId,
} from './mathTemplates';

const CARET_MARKER = '\uE000';

export interface FormulaInsertionResult {
    value: string;
    selectionStart: number;
    selectionEnd: number;
}

export interface InsertMathTemplateInput {
    value: string;
    selectionStart: number;
    selectionEnd: number;
    template: MathTemplate | MathTemplateId;
    values?: Record<string, string>;
}

const wrapMath = (inner: string): string => `$${inner}$`;

export const insertMathTemplate = ({
    value,
    selectionStart,
    selectionEnd,
    template,
    values = {},
}: InsertMathTemplateInput): FormulaInsertionResult => {
    const source = String(value ?? '');
    const safeStart = Math.max(0, Math.min(selectionStart, source.length));
    const safeEnd = Math.max(safeStart, Math.min(selectionEnd, source.length));
    const selected = source.slice(safeStart, safeEnd);
    const resolvedTemplate = typeof template === 'string' ? getMathTemplate(template) : template;
    let caretAssigned = false;

    const caret = (visibleValue = ''): string => {
        if (caretAssigned) return visibleValue;
        caretAssigned = true;
        return `${CARET_MARKER}${visibleValue}`;
    };

    const nextValue = (key: string, fallback = ''): string => {
        const provided = values[key];
        if (typeof provided === 'string' && provided.length > 0) return provided;
        if (fallback.length > 0) return fallback;
        return caret();
    };

    const rawInsertion = wrapMath(resolvedTemplate.format({
        selected,
        values,
        nextValue,
        caret,
    }));
    const markerIndex = rawInsertion.indexOf(CARET_MARKER);
    const insertion = rawInsertion.replace(CARET_MARKER, '');
    const nextValueText = `${source.slice(0, safeStart)}${insertion}${source.slice(safeEnd)}`;
    const nextCaret = safeStart + (markerIndex >= 0 ? markerIndex : insertion.length);

    return {
        value: nextValueText,
        selectionStart: nextCaret,
        selectionEnd: nextCaret,
    };
};
