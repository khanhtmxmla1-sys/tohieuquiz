/**
 * questionHelpers.ts
 *
 * Pure utility functions for UI display logic and text manipulation
 * related to quiz questions. Extracted from the QuizPreview monolith.
 */

import { QuestionType } from '../../../types';

// ---------------------------------------------------------------------------
// getTypeLabel
// ---------------------------------------------------------------------------

/** Returns a human-readable Vietnamese label for each question type. */
export function getTypeLabel(type: QuestionType): string {
    const labels: Record<QuestionType, string> = {
        [QuestionType.MCQ]: 'Trắc nghiệm',
        [QuestionType.TRUE_FALSE]: 'Đúng/Sai',
        [QuestionType.SHORT_ANSWER]: 'Điền đáp án',
        [QuestionType.MATCHING]: 'Nối cột',
        [QuestionType.MULTIPLE_SELECT]: 'Chọn nhiều',
        [QuestionType.DRAG_DROP]: 'Kéo thả',
        [QuestionType.ORDERING]: 'Sắp xếp',
        [QuestionType.IMAGE_QUESTION]: 'Có hình',
        [QuestionType.DROPDOWN]: 'Dropdown',
        [QuestionType.UNDERLINE]: 'Gạch chân',
        [QuestionType.CATEGORIZATION]: 'Phân loại',
        [QuestionType.WORD_SCRAMBLE]: 'Ghép chữ',
        [QuestionType.RIDDLE]: 'Câu đố',
        [QuestionType.ERROR_CORRECTION]: 'Tìm từ sai',
        [QuestionType.GEOMETRY]: 'Hình học',
    };
    return labels[type] ?? type;
}

// ---------------------------------------------------------------------------
// supportsDistractors
// ---------------------------------------------------------------------------

/** Returns true if the question type can use AI-generated smart distractors. */
export function supportsDistractors(type: QuestionType): boolean {
    return [
        QuestionType.MCQ,
        QuestionType.MULTIPLE_SELECT,
        QuestionType.IMAGE_QUESTION,
    ].includes(type);
}

// ---------------------------------------------------------------------------
// insertTags
// ---------------------------------------------------------------------------

/**
 * Wraps the selected substring of `text` (from `start` to `end`) with HTML
 * bold (<b>) or italic (<i>) tags.
 *
 * If `start === end` (no selection), the empty tags are inserted at the cursor.
 */
export function insertTags(
    text: string,
    tag: 'b' | 'i',
    start: number,
    end: number,
): string {
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;

    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    return `${before}${openTag}${selection}${closeTag}${after}`;
}

// ---------------------------------------------------------------------------
// getDifficultyLabel
// ---------------------------------------------------------------------------

/** Returns a Vietnamese label string for difficulty level (1 | 2 | 3). */
export function getDifficultyLabel(difficulty: 1 | 2 | 3): string {
    const labels: Record<1 | 2 | 3, string> = {
        1: '⭐ Mức 1',
        2: '⭐⭐ Mức 2',
        3: '⭐⭐⭐ Mức 3',
    };
    return labels[difficulty];
}

/** Returns a Tailwind CSS class string for the difficulty badge color. */
export function getDifficultyColorClass(difficulty: 1 | 2 | 3): string {
    const classes: Record<1 | 2 | 3, string> = {
        1: 'bg-green-100 text-green-700',
        2: 'bg-yellow-100 text-yellow-700',
        3: 'bg-red-100 text-red-700',
    };
    return classes[difficulty];
}
