import type { Question } from '../../../types';
import { QuestionType } from '../../../types';

let fallbackId = 0;
const createId = (prefix: string): string => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `${prefix}-${uuid}`;
    fallbackId += 1;
    return `${prefix}-${Date.now()}-${fallbackId}`;
};

const baseDraft = (type: QuestionType) => ({
    id: createId('q-manual'),
    type,
    difficulty: 1 as const,
    points: 1,
});

export const createManualQuestionDraft = (type: QuestionType): Question => {
    const base = baseDraft(type);
    switch (type) {
        case QuestionType.MCQ:
            return { ...base, type, question: '', options: ['', '', '', ''], correctAnswer: '' };
        case QuestionType.MULTIPLE_SELECT:
            return { ...base, type, question: '', options: ['', '', '', ''], correctAnswers: [] };
        case QuestionType.TRUE_FALSE:
            return {
                ...base,
                type,
                mainQuestion: '',
                items: [
                    { id: createId('tf'), statement: '', isCorrect: true },
                    { id: createId('tf'), statement: '', isCorrect: false },
                ],
            };
        case QuestionType.SHORT_ANSWER:
            return { ...base, type, question: '', correctAnswer: '' };
        case QuestionType.MATCHING:
            return {
                ...base,
                type,
                question: '',
                pairs: [
                    { left: '', right: '', image: '' },
                    { left: '', right: '', image: '' },
                ],
            };
        case QuestionType.DRAG_DROP:
            return { ...base, type, question: '', text: '', blanks: [''], distractors: [''] };
        case QuestionType.ORDERING:
            return { ...base, type, question: '', items: ['', ''], correctOrder: [0, 1] };
        case QuestionType.IMAGE_QUESTION:
            return {
                ...base,
                type,
                question: '',
                image: '',
                options: ['', '', '', ''],
                correctAnswer: '',
                optionImages: ['', '', '', ''],
            };
        case QuestionType.DROPDOWN:
            return {
                ...base,
                type,
                question: '',
                text: '',
                blanks: [{
                    id: createId('dropdown'),
                    options: ['', ''],
                    correctAnswer: '',
                }],
            };
        case QuestionType.UNDERLINE:
            return {
                ...base,
                type,
                question: '',
                sentence: '',
                words: [],
                correctWordIndexes: [],
            };
        case QuestionType.CATEGORIZATION: {
            const firstCategoryId = createId('category');
            const secondCategoryId = createId('category');
            return {
                ...base,
                type,
                question: '',
                categories: [
                    { id: firstCategoryId, name: '' },
                    { id: secondCategoryId, name: '' },
                ],
                items: [
                    { id: createId('category-item'), content: '', categoryId: firstCategoryId },
                    { id: createId('category-item'), content: '', categoryId: secondCategoryId },
                ],
            };
        }
        case QuestionType.WORD_SCRAMBLE:
            return { ...base, type, question: '', letters: ['', ''], correctWord: '' };
        case QuestionType.RIDDLE:
            return {
                ...base,
                type,
                question: '',
                riddleLines: ['', ''],
                correctAnswer: '',
                answerType: 'original',
                answerLabel: 'Đáp án',
            };
        case QuestionType.ERROR_CORRECTION:
            return {
                ...base,
                type,
                question: '',
                passage: '',
                wrongWord: '',
                correctWord: '',
            };
        default:
            return { ...base, type: QuestionType.MCQ, question: '', options: ['', '', '', ''], correctAnswer: '' };
    }
};
