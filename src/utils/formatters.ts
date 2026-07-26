/**
 * Text Formatting Utilities
 *
 * All mathematical content passes through the shared parser in mathText.ts.
 */
import { normalizeMathText, splitMathSegments } from './mathText';

const toRenderableString = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(toRenderableString).join(', ');
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const extracted = record.content ?? record.text ?? record.sentence ?? record.label ?? record.name ?? record.value;
        if (extracted !== undefined && extracted !== null) return toRenderableString(extracted);

        const keys = Object.keys(record);
        if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
            return keys
                .map(Number)
                .sort((a, b) => a - b)
                .map((key) => String(record[String(key)] ?? ''))
                .join('');
        }
        return JSON.stringify(value);
    }
    return String(value);
};

export const sanitizeLatex = (text: string): string => normalizeMathText(text);
export const formatMathText = (text: unknown): string => normalizeMathText(toRenderableString(text));
/** @deprecated Use formatMathText instead. */
export const formatText = formatMathText;

export const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const formatScore = (score: number, maxScore: number = 10): string => `${score}/${maxScore}`;

export const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatPercentage = (value: number, total: number, decimals: number = 0): string => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(decimals)}%`;
};

const escapeHtml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatPlainHtml = (value: string): string => {
    let output = escapeHtml(value);
    for (const tag of ['u', 'b', 'i', 'em', 'strong']) {
        output = output
            .replace(new RegExp(`&lt;${tag}&gt;`, 'gi'), `<${tag}>`)
            .replace(new RegExp(`&lt;/${tag}&gt;`, 'gi'), `</${tag}>`);
    }

    // Plain-text underline notation is interpreted only outside TeX math.
    if (!output.includes('$') && !output.includes('\\')) {
        output = output
            .replace(/_([^_\s]+)_/g, '<u>$1</u>')
            .replace(/([a-zA-Z])_([a-zA-Z]+)_([a-zA-Z])/g, '$1<u>$2</u>$3');
    }
    return output;
};

/** Render text as safe HTML while preserving TeX subscripts and commands. */
export const formatHtmlText = (text: unknown): string => {
    const normalized = formatMathText(text);
    if (!normalized) return '';

    return splitMathSegments(normalized)
        .map((segment) => segment.type === 'math' ? escapeHtml(segment.raw) : formatPlainHtml(segment.raw))
        .join('');
};