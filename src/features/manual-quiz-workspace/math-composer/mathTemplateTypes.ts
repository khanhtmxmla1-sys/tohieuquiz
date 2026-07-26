export type MathTemplateCategory = 'basic' | 'fractions' | 'geometry' | 'symbols' | 'examples';

export type MathTemplateId =
    | 'plus' | 'minus' | 'multiply' | 'divide' | 'equals' | 'notEqual'
    | 'lessThan' | 'greaterThan' | 'lessOrEqual' | 'greaterOrEqual'
    | 'fraction' | 'mixedNumber' | 'sqrt' | 'power' | 'subscript' | 'percent' | 'absolute'
    | 'angle' | 'segment' | 'triangle' | 'parallel' | 'perpendicular' | 'degree'
    | 'areaUnit' | 'volumeUnit'
    | 'pi' | 'approximately' | 'infinity' | 'belongsTo' | 'notBelongsTo'
    | 'union' | 'intersection' | 'arrow' | 'implies'
    | 'blankEquation' | 'fractionSum' | 'perimeterFormula' | 'areaFormula';

export interface MathTemplateField {
    key: string;
    label: string;
    placeholder: string;
    defaultValue?: string;
    inputMode?: 'text' | 'decimal';
}

export interface MathTemplateFormatContext {
    selected: string;
    values: Record<string, string>;
    nextValue(key: string, fallback?: string): string;
    caret(value?: string): string;
}

export interface MathTemplate {
    id: MathTemplateId;
    label: string;
    title: string;
    category: MathTemplateCategory;
    fields: MathTemplateField[];
    format(context: MathTemplateFormatContext): string;
}

export const noMathTemplateFields: MathTemplateField[] = [];

export const mathTemplateField = (
    key: string,
    label: string,
    placeholder: string,
    defaultValue?: string,
): MathTemplateField => ({
    key,
    label,
    placeholder,
    defaultValue,
    inputMode: 'text',
});

export const commandMathTemplate = (
    id: MathTemplateId,
    label: string,
    title: string,
    category: MathTemplateCategory,
    command: string,
): MathTemplate => ({
    id,
    label,
    title,
    category,
    fields: noMathTemplateFields,
    format: () => command,
});
