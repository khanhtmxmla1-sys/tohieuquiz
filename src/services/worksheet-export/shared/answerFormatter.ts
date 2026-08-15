import { QuestionType } from '../../../types';
import { buildWorksheetMatchingLayout } from './matchingLayout';
import { normalizeWorksheetMath } from './mathNormalizer';

export function getWorksheetAnswerText(question: any, wrapForWord = false): string {
    const clean = (text: string) => normalizeWorksheetMath(text, wrapForWord);
    switch (question.type) {
        case QuestionType.MCQ:
        case QuestionType.IMAGE_QUESTION: {
            const letters = ['A', 'B', 'C', 'D'];
            const index = letters.indexOf(question.correctAnswer);
            return question.options?.[index]
                ? `${question.correctAnswer}. ${clean(question.options[index])}`
                : question.correctAnswer;
        }
        case QuestionType.MULTIPLE_SELECT:
            return (question.correctAnswers || []).join(', ');
        case QuestionType.TRUE_FALSE:
            return (question.items || []).map((item: any, index: number) =>
                `${index + 1}. ${item.isCorrect ? 'Đúng' : 'Sai'}`).join('  |  ');
        case QuestionType.SHORT_ANSWER:
        case QuestionType.RIDDLE:
            return clean(question.correctAnswer || '');
        case QuestionType.MATCHING:
            return buildWorksheetMatchingLayout(question).answerText;
        case QuestionType.DRAG_DROP:
            return (question.blanks || [])
                .map((item: unknown) => typeof item === 'string'
                    ? item
                    : (item && typeof item === 'object' && 'content' in item
                        ? String((item as { content?: unknown }).content ?? '')
                        : String(item ?? '')))
                .join(' / ');
        case QuestionType.DROPDOWN:
            return (question.blanks || [])
                .map((blank: any, index: number) =>
                    `${index + 1}. ${clean(String(blank?.correctAnswer ?? ''))}`)
                .join(' | ');
        case QuestionType.ORDERING:
            return (question.correctOrder || []).map((item: number, index: number) =>
                `${index + 1}=(${item + 1})`).join('  ');
        case QuestionType.WORD_SCRAMBLE:
            return clean(question.correctWord || '');
        case QuestionType.UNDERLINE:
            return (question.correctWordIndexes || []).map((index: number) =>
                `"${(question.words || [])[index] || index}"`).join(', ');
        case QuestionType.CATEGORIZATION:
            return (question.categories || []).map((category: any) => {
                const items = (question.items || [])
                    .filter((item: any) => item.categoryId === category.id)
                    .map((item: any) => item.content);
                return `${category.name}: ${items.join(', ')}`;
            }).join(' | ');
        case QuestionType.ERROR_CORRECTION:
            return `Sai: "${clean(question.wrongWord)}"  →  Đúng: "${clean(question.correctWord)}"`;
        default:
            return clean(question.correctAnswer || '');
    }
}
