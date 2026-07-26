import type { MathTemplateId } from './mathTemplates';

const RECENT_FORMULA_KEY_PREFIX = 'tohieuquiz:math-recent:v1';
const MAX_RECENT_FORMULAS = 8;

export interface RecentMathFormulaInput {
    templateId: MathTemplateId;
    values: Record<string, string>;
    label: string;
    preview: string;
}

export interface RecentMathFormula extends RecentMathFormulaInput {
    id: string;
    usedAt: string;
}

const storageKey = (ownerUsername: string): string =>
    `${RECENT_FORMULA_KEY_PREFIX}:${ownerUsername}`;

const isRecentFormula = (value: unknown): value is RecentMathFormula => {
    if (!value || typeof value !== 'object') return false;
    const item = value as Partial<RecentMathFormula>;
    return typeof item.id === 'string'
        && typeof item.templateId === 'string'
        && typeof item.label === 'string'
        && typeof item.preview === 'string'
        && typeof item.usedAt === 'string'
        && !!item.values
        && typeof item.values === 'object';
};

export const loadRecentMathFormulas = (ownerUsername: string): RecentMathFormula[] => {
    if (!ownerUsername || typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(storageKey(ownerUsername));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isRecentFormula).slice(0, MAX_RECENT_FORMULAS);
    } catch {
        return [];
    }
};

export const saveRecentMathFormula = (
    ownerUsername: string,
    formula: RecentMathFormulaInput,
): RecentMathFormula[] => {
    if (!ownerUsername || typeof localStorage === 'undefined') return [];
    const id = `${formula.templateId}:${JSON.stringify(formula.values)}`;
    const next: RecentMathFormula = {
        ...formula,
        id,
        usedAt: new Date().toISOString(),
    };
    const items = [
        next,
        ...loadRecentMathFormulas(ownerUsername).filter((item) => item.id !== id),
    ].slice(0, MAX_RECENT_FORMULAS);
    try {
        localStorage.setItem(storageKey(ownerUsername), JSON.stringify(items));
    } catch {
        return loadRecentMathFormulas(ownerUsername);
    }
    return items;
};
