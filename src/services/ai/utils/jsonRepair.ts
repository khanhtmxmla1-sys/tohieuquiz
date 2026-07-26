/**
 * @module jsonRepair
 * Utilities for parsing, repairing and normalising AI-generated JSON quiz data.
 * Also handles LaTeX formatting fixes within question text fields.
 */

import type { AIProvider } from '../../geminiService';
import { normalizeMathText } from '../../../utils/mathText';
import { normalizeQuestionMath } from '../../../utils/questionMath';

// ─────────────────────────────────────────────────────────
//  JSON PARSING
// ─────────────────────────────────────────────────────────

/** Parse AI response text that may contain broken JSON, auto-repairing common issues. */
export const parseAndRepairJSON = (text: string): unknown => {
  // Step 1: Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Step 2: Find JSON object boundaries
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');

  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
    throw new Error('Không tìm thấy JSON hợp lệ trong response của AI.');
  }

  cleaned = cleaned.substring(startIdx, endIdx + 1);

  // Step 3: Try to parse directly first
  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn('JSON parse failed, attempting repair...');
  }

  // Step 4: Attempt to repair common JSON issues
  let repaired = cleaned;

  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  repaired = repaired.replace(/}\s*{/g, '},{');
  repaired = repaired.replace(/]\s*\[/g, '],[');
  repaired = repaired.replace(/"\s*{/g, '",{');
  repaired = repaired.replace(/}\s*"/g, '},"');
  repaired = repaired.replace(/]\s*"/g, '],"');
  repaired = repaired.replace(/"\s*\[/g, '",[');
  repaired = repaired.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
  repaired = repaired.replace(/:\s*'([^']*)'/g, ': "$1"');
  // Handle invalid escapes from model output (for example: "\_") by escaping "\" itself.
  repaired = repaired.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  repaired = repaired.replace(/[\x00-\x1F\x7F]/g, ' ');

  // Step 5: Try parsing repaired JSON
  try {
    return JSON.parse(repaired);
  } catch (e2) {
    console.error('JSON repair failed:', e2);
    throw new Error('AI trả về JSON không hợp lệ. Vui lòng thử tạo đề lại.');
  }
};
// ─────────────────────────────────────────────────────────
//  LATEX FIXES
// ─────────────────────────────────────────────────────────

/** Normalize a single AI text field without flattening interactive math placeholders. */
export const fixLatexInText = (text: string): string => normalizeMathText(text);

/** Normalize all nested text fields in a generated question. */
export const fixQuestionLatex = (question: Record<string, unknown>): Record<string, unknown> =>
  normalizeQuestionMath(question);

// ─────────────────────────────────────────────────────────
//  METADATA NORMALISATION
// ─────────────────────────────────────────────────────────

export const AI_CORE_SUBJECT_IDS = [
  'toan',
  'tieng-viet',
  'tieng-anh',
  'tu-nhien-xa-hoi',
  'tin-hoc',
] as const;

const stripVietnameseDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeCategoryKey = (value: string): string =>
  stripVietnameseDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const CATEGORY_ALIAS_TO_CORE: Record<string, (typeof AI_CORE_SUBJECT_IDS)[number]> = {
  toan: 'toan', math: 'toan', mathematics: 'toan', 'toan-hoc': 'toan',
  'tieng-viet': 'tieng-viet', tiengviet: 'tieng-viet', 'ngu-van': 'tieng-viet', van: 'tieng-viet',
  'tieng-anh': 'tieng-anh', tienganh: 'tieng-anh', english: 'tieng-anh',
  'tu-nhien-xa-hoi': 'tu-nhien-xa-hoi', 'tu-nhien-va-xa-hoi': 'tu-nhien-xa-hoi',
  'khoa-hoc': 'tu-nhien-xa-hoi', 'khoa-hoc-xa-hoi': 'tu-nhien-xa-hoi',
  'tin-hoc': 'tin-hoc', tinhoc: 'tin-hoc', it: 'tin-hoc',
};

export const normalizeDetectedCategory = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return CATEGORY_ALIAS_TO_CORE[normalizeCategoryKey(trimmed)];
};

export const normalizeDetectedLesson = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, 180);
};

const normalizeTag = (raw: string): string =>
  stripVietnameseDiacritics(raw)
    .toLowerCase()
    .replace(/^#+/g, '')
    .trim()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

export const normalizeSuggestedTags = (raw: unknown): string[] => {
  const source = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of source) {
    const value = normalizeTag(String(item ?? ''));
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= 5) break;
  }
  return result;
};

// ─────────────────────────────────────────────────────────
//  QUIZ VALIDATION
// ─────────────────────────────────────────────────────────

/** Validate and auto-fix a raw quiz object returned by an AI provider. */
export const validateAndFixQuiz = (quiz: unknown, maxQuestions?: number): unknown => {
  if (!quiz || typeof quiz !== 'object') return quiz;

  const q = quiz as Record<string, unknown>;

  const detectedCategory = normalizeDetectedCategory(q.detectedCategory);
  if (detectedCategory) q.detectedCategory = detectedCategory; else delete q.detectedCategory;

  const detectedLesson = normalizeDetectedLesson(q.detectedLesson);
  if (detectedLesson) q.detectedLesson = detectedLesson; else delete q.detectedLesson;

  const suggestedTags = normalizeSuggestedTags(q.suggestedTags);
  if (suggestedTags.length > 0) q.suggestedTags = suggestedTags; else delete q.suggestedTags;

  if (!q.questions) return q;

  if (maxQuestions && (q.questions as unknown[]).length > maxQuestions) {
    console.warn(`[validateAndFixQuiz] ⚠️ AI returned ${(q.questions as unknown[]).length} questions but only ${maxQuestions} requested. Slicing...`);
    q.questions = (q.questions as unknown[]).slice(0, maxQuestions);
  }

  q.questions = (q.questions as Record<string, unknown>[]).map((item) => fixQuestionLatex(item));

  if ((q.questions as Record<string, unknown>[]).some((item) => item.difficultyLevel)) {
    (q.questions as Record<string, unknown>[]).sort((a, b) => {
      const la = (a.difficultyLevel as number) || 2;
      const lb = (b.difficultyLevel as number) || 2;
      return la - lb;
    });
  }

  return q;
};

// Re-export AIProvider type so providers don't need to import from the root
export type { AIProvider };

