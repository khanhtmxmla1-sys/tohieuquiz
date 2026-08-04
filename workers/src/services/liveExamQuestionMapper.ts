import type { Question } from '../../../src/types';

function parseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function parsePipeList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value !== 'string' || value.length === 0) return [];
    return value.split('|');
}

/**
 * `questions.correct_answer` giữ hai dạng: JSON (mảng/đối tượng) cho các loại nhiều đáp án
 * (MULTIPLE_SELECT, ORDERING, UNDERLINE...) và văn bản thuần cho các loại một đáp án.
 *
 * Chỉ được parse dạng thứ nhất. `JSON.parse` vô điều kiện biến đáp án `"56"` thành **số** `56`,
 * mà `calculateStudentScore` so sánh MCQ bằng `===` với đáp án chuỗi của học sinh, nên mọi câu
 * có đáp án là số đều bị chấm sai — với đề toán thì đó là gần như toàn bộ câu hỏi.
 */
function looksLikeJsonCollection(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return (trimmed.startsWith('[') && trimmed.endsWith(']'))
        || (trimmed.startsWith('{') && trimmed.endsWith('}'));
}

export function mapLiveExamQuestionRow(row: any): Question {
    const type = String(row.type || '').toUpperCase();
    const items = parseJson<any[]>(row.items, []);
    const blanks = parseJson<any[]>(row.blanks, []);
    const distractors = parseJson<any[]>(row.distractors, []);
    const words = parseJson<any[]>(row.words, []);
    const rawCorrectAnswer = row.correct_answer ?? '';
    const parsedCorrectAnswer = looksLikeJsonCollection(rawCorrectAnswer)
        ? parseJson<any>(rawCorrectAnswer, rawCorrectAnswer)
        : rawCorrectAnswer;

    const base: any = {
        id: String(row.id),
        type,
        question: String(row.question || ''),
        mainQuestion: String(row.question || ''),
        options: parsePipeList(row.options),
        correctAnswer: parsedCorrectAnswer,
        image: String(row.image || ''),
        svgContent: String(row.svgContent ?? row.svg_content ?? '') || undefined,
        svgAlt: String(row.svgAlt ?? row.svg_alt ?? '') || undefined,
        svgVersion: String(row.svgContent ?? row.svg_content ?? '')
            && String(row.svgAlt ?? row.svg_alt ?? '') ? 1 : undefined,
        explanation: '',
        difficulty: row.difficulty || undefined,
    };

    switch (type) {
        case 'TRUE_FALSE':
            base.items = items;
            break;
        case 'MATCHING':
            base.pairs = items;
            break;
        case 'MULTIPLE_SELECT':
            base.correctAnswers = Array.isArray(parsedCorrectAnswer) ? parsedCorrectAnswer : [];
            break;
        case 'DRAG_DROP':
            base.text = String(row.text_field || '');
            base.blanks = blanks;
            base.distractors = distractors;
            break;
        case 'DROPDOWN':
            base.text = String(row.text_field || '');
            base.blanks = blanks;
            break;
        case 'ORDERING':
            base.items = items;
            base.correctOrder = Array.isArray(parsedCorrectAnswer) ? parsedCorrectAnswer : [];
            break;
        case 'IMAGE_QUESTION':
            base.optionImages = distractors;
            break;
        case 'UNDERLINE':
            base.sentence = String(row.sentence || row.text_field || '');
            base.words = words.length > 0 ? words : items;
            base.correctWordIndexes = parseJson<any[]>(
                row.correct_word_indexes,
                Array.isArray(parsedCorrectAnswer) ? parsedCorrectAnswer : [],
            );
            break;
        case 'CATEGORIZATION':
            base.items = items;
            base.categories = distractors;
            break;
        case 'WORD_SCRAMBLE':
            base.letters = items;
            base.correctWord = String(row.correct_answer || '');
            base.hint = String(row.text_field || '');
            break;
        case 'RIDDLE':
            base.riddleLines = items;
            base.answerLabel = String(row.text_field || '');
            base.hint = String(row.sentence || '');
            break;
        case 'ERROR_CORRECTION':
            base.passage = String(row.text_field || '');
            base.wrongWord = typeof row.distractors === 'string' ? row.distractors : '';
            base.correctWord = String(row.correct_answer || '');
            break;
        default:
            break;
    }

    return base as Question;
}
