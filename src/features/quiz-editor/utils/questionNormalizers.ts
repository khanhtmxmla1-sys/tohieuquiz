/**
 * questionNormalizers.ts
 *
 * Pure utility functions for normalizing raw/legacy quiz data into
 * well-typed domain objects. Extracted from the QuizPreview monolith.
 *
 * All functions are stateless and have no side-effects.
 */

import type { TrueFalseItem, DropdownBlank } from '../../../types';

// ---------------------------------------------------------------------------
// toBoolean
// ---------------------------------------------------------------------------

/**
 * Coerces a loosely-typed value (string "true"/"false"/"d"/"s", number 0/1,
 * boolean) into a proper boolean.
 * Used when normalising TRUE_FALSE items that may have been serialised in many
 * different ways across older data formats.
 */
export function toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    if (['true', '1', 'd', 'yes'].includes(normalized)) return true;
    if (['false', '0', 's', 'no'].includes(normalized)) return false;
    return Boolean(value);
}

// ---------------------------------------------------------------------------
// normalizeTrueFalseItems
// ---------------------------------------------------------------------------

/**
 * Normalizes an array of TRUE_FALSE items from raw/unknown data.
 * Handles legacy field names (isCorrect | isTrue | correct | answer).
 */
export function normalizeTrueFalseItems(items: unknown): TrueFalseItem[] {
    if (!Array.isArray(items)) return [];

    return items.map((item: unknown, idx: number) => {
        if (item && typeof item === 'object') {
            const raw = item as Record<string, unknown>;
            return {
                id: String(raw.id ?? `item-${idx + 1}`),
                statement: String(raw.statement ?? raw.text ?? raw.content ?? ''),
                isCorrect: toBoolean(raw.isCorrect ?? raw.isTrue ?? raw.correct ?? raw.answer),
            };
        }

        return {
            id: `item-${idx + 1}`,
            statement: String(item ?? ''),
            isCorrect: false,
        };
    });
}

// ---------------------------------------------------------------------------
// normalizeDropdownBlanks
// ---------------------------------------------------------------------------

/**
 * Normalizes an array of DROPDOWN blanks from raw/unknown data.
 * Ensures each blank has a valid options array and a correctAnswer.
 * - Options may arrive as array, pipe-separated string, or under key "choices"
 * - correctAnswer is promoted to the front of options if missing
 */
export function normalizeDropdownBlanks(blanks: unknown): DropdownBlank[] {
    if (!Array.isArray(blanks)) return [];

    return blanks.map((blank: unknown, idx: number) => {
        const raw = (blank && typeof blank === 'object' ? blank : {}) as Record<string, unknown>;

        const rawOptions = Array.isArray(raw.options)
            ? (raw.options as unknown[])
            : typeof raw.options === 'string'
                ? (raw.options as string).split('|')
                : Array.isArray(raw.choices)
                    ? (raw.choices as unknown[])
                    : [];

        let options = rawOptions
            .map((opt) => String(opt ?? '').trim())
            .filter((opt) => opt.length > 0);

        let correctAnswer = String(raw.correctAnswer ?? raw.answer ?? raw.correct ?? '').trim();

        // Fall back to first option if no correct answer specified
        if (!correctAnswer && options.length > 0) {
            correctAnswer = options[0];
        }

        // Ensure correct answer is present in options list
        if (correctAnswer && !options.includes(correctAnswer)) {
            options = [correctAnswer, ...options];
        }

        // Ensure at least 2 options so the dropdown is meaningful
        if (options.length === 0) {
            options = ['', ''];
        } else if (options.length === 1) {
            options = [...options, ''];
        }

        return {
            id: String(raw.id ?? `${idx + 1}`),
            options,
            correctAnswer,
        };
    });
}

// ---------------------------------------------------------------------------
// fixReorderQuestion
// ---------------------------------------------------------------------------

/**
 * Rewrites "Reorder the words: a : b : c" sentences so that word separators
 * consistently use " / " instead of " : ", avoiding conflict with the leading
 * colon that follows the verb "Reorder".
 *
 * Example:
 *   "Reorder the words: apple : banana : cherry"
 *   → "Reorder the words: apple / banana / cherry"
 */
export function fixReorderQuestion(text: string): string {
    if (!text) return text;

    const reorderMatch = text.match(/^(Reorder(?:\s+the\s+words)?)\s*[:/]\s*/i);
    if (reorderMatch) {
        const prefix = reorderMatch[1];
        const wordsPartRaw = text.substring(reorderMatch[0].length);
        const wordsPart = wordsPartRaw.replace(/\s*:\s*/g, ' / ');
        return `${prefix}: ${wordsPart}`;
    }

    return text;
}
