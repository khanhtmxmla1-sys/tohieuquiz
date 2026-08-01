import type { NormalizedOption } from './types';

export const getOptionId = (index: number): string => `option-${index}`;
export const getMatchingLeftId = (index: number): string => `left-${index}`;
export const getMatchingRightId = (index: number): string => `right-${index}`;
export const getOrderingItemId = (index: number): string => `item-${index}`;

export const getBlankId = (question: unknown, index: number): string => {
  const record = asRecord(question);
  const blanks = asArray(record.blanks);
  const blank = blanks[index];
  if (blank && typeof blank === 'object' && !Array.isArray(blank)) {
    const id = String((blank as Record<string, unknown>).id ?? '').trim();
    if (id) return id;
  }
  return `blank-${index}`;
};

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return trimmed.split('|');
};

export const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

export const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .replace(/^'/, '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('vi-VN');

export const normalizeCompactText = (value: unknown): string =>
  normalizeText(value).replace(/\s+/g, '');

export const optionText = (value: unknown): string => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return String(record.text ?? record.content ?? record.label ?? record.value ?? '');
  }
  return String(value ?? '');
};

export const buildOptions = (value: unknown): NormalizedOption[] =>
  asArray(value).map((option, index) => ({
    id: getOptionId(index),
    index,
    text: optionText(option),
  }));

export const hasDuplicateNormalizedText = (values: readonly string[]): boolean => {
  const normalized = values.map(normalizeText).filter(Boolean);
  return new Set(normalized).size !== normalized.length;
};

export const extractPlaceholderTokens = (value: unknown): string[] => {
  const text = String(value ?? '');
  return Array.from(text.matchAll(/\[([^\]]+)\]|_{3,}/g)).map((match) => {
    if (match[1] !== undefined) return match[1];
    return match[0];
  });
};
