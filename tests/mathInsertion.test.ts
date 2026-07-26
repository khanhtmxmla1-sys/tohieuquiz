import { describe, expect, it } from 'vitest';
import {
    getMathTemplate,
    listMathTemplates,
} from '../src/features/manual-quiz-workspace/math-composer/mathTemplates';
import { insertMathTemplate } from '../src/features/manual-quiz-workspace/math-composer/mathInsertion';

describe('manual quiz math insertion domain', () => {
    it.each([
        ['angle', '$\\angle ABC$'],
        ['segment', '$\\overline{AB}$'],
        ['triangle', '$\\triangle ABC$'],
        ['parallel', '$AB \\parallel CD$'],
        ['perpendicular', '$AB \\perp CD$'],
    ] as const)('preserves the legacy %s output', (templateId, expected) => {
        const result = insertMathTemplate({
            value: '',
            selectionStart: 0,
            selectionEnd: 0,
            template: templateId,
        });

        expect(result.value).toBe(expected);
    });

    it('uses a selected value as the numerator and moves the caret to the denominator', () => {
        const result = insertMathTemplate({
            value: 'Tính 12',
            selectionStart: 5,
            selectionEnd: 7,
            template: 'fraction',
        });

        expect(result.value).toBe('Tính $\\frac{12}{}$');
        expect(result.value[result.selectionStart - 1]).toBe('{');
        expect(result.value[result.selectionStart]).toBe('}');
    });

    it.each([
        ['multiply', {}, '$\\times$'],
        ['notEqual', {}, '$\\neq$'],
        ['lessOrEqual', {}, '$\\leq$'],
        ['greaterOrEqual', {}, '$\\geq$'],
        ['mixedNumber', { whole: '2', numerator: '1', denominator: '3' }, '$2\\frac{1}{3}$'],
        ['percent', { value: '25' }, '$25\\%$'],
        ['absolute', { value: '-5' }, '$\\left|-5\\right|$'],
        ['areaUnit', { unit: 'cm' }, '$cm^{2}$'],
        ['volumeUnit', { unit: 'm' }, '$m^{3}$'],
    ] as const)('formats %s without requiring raw LaTeX', (templateId, values, expected) => {
        const result = insertMathTemplate({
            value: '',
            selectionStart: 0,
            selectionEnd: 0,
            template: templateId,
            values,
        });

        expect(result.value).toBe(expected);
        expect(result.selectionStart).toBe(result.value.length);
    });

    it('places the caret in the first missing structured field', () => {
        const result = insertMathTemplate({
            value: 'Kết quả: ',
            selectionStart: 9,
            selectionEnd: 9,
            template: 'mixedNumber',
            values: { whole: '2' },
        });

        expect(result.value).toBe('Kết quả: $2\\frac{}{}$');
        expect(result.value[result.selectionStart - 1]).toBe('{');
        expect(result.value[result.selectionStart]).toBe('}');
    });

    it('clamps invalid selections and replaces the selected range once', () => {
        const result = insertMathTemplate({
            value: 'abc',
            selectionStart: -50,
            selectionEnd: 99,
            template: 'sqrt',
        });

        expect(result.value).toBe('$\\sqrt{abc}$');
        expect(result.selectionStart).toBe(result.value.length);
    });

    it('exposes Vietnamese labels, categories and field schemas for the visual composer', () => {
        const fraction = getMathTemplate('fraction');
        const categories = new Set(listMathTemplates().map((template) => template.category));

        expect(fraction).toMatchObject({
            label: 'a⁄b',
            title: 'Phân số',
            category: 'fractions',
        });
        expect(fraction.fields.map((field) => field.key)).toEqual(['numerator', 'denominator']);
        expect(categories).toEqual(new Set(['basic', 'fractions', 'geometry', 'symbols', 'examples']));
    });
});
