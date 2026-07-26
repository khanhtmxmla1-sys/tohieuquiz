import { AI_CORE_SUBJECT_IDS } from '../../../services/geminiService';

const AI_CORE_CATEGORY_SET = new Set<string>(AI_CORE_SUBJECT_IDS);

/**
 * Normalizes a tag value for consistency.
 */
export const normalizeTagValue = (value: string): string => {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/^#+/g, '')
        .trim()
        .replace(/[^a-z0-9\s_-]/g, ' ')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
};

/**
 * Normalizes an array or comma-separated string of tags.
 */
export const normalizeTags = (source: unknown): string[] => {
    const values = Array.isArray(source)
        ? source
        : typeof source === 'string'
            ? source.split(',')
            : [];

    const seen = new Set<string>();
    const tags: string[] = [];
    for (const raw of values) {
        const normalized = normalizeTagValue(String(raw ?? ''));
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        tags.push(normalized);
        if (tags.length >= 5) break;
    }
    return tags;
};

/**
 * Validates and normalizes an AI detected category against core subject IDs.
 */
export const normalizeAiCategory = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    if (!normalized || !AI_CORE_CATEGORY_SET.has(normalized)) return null;
    return normalized;
};
