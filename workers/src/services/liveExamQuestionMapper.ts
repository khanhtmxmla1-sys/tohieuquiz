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

export function mapLiveExamQuestionRow(row: any): Question {
    const type = String(row.type || '').toUpperCase();
    const items = parseJson<any[]>(row.items, []);
    const blanks = parseJson<any[]>(row.blanks, []);
    const distractors = parseJson<any[]>(row.distractors, []);
    const words = parseJson<any[]>(row.words, []);
    const parsedCorrectAnswer = parseJson<any>(row.correct_answer, row.correct_answer ?? '');

    const base: any = {
        id: String(row.id),
        type,
        question: String(row.question || ''),
        mainQuestion: String(row.question || ''),
        options: parsePipeList(row.options),
        correctAnswer: parsedCorrectAnswer,
        image: String(row.image || ''),
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
