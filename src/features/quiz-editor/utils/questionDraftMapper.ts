/**
 * questionDraftMapper.ts
 *
 * Bidirectional mapping between domain Question types and EditorDraft types.
 *
 * - questionToDraft(question): converts a saved Question → editable draft
 * - draftToQuestion(draft, original): converts a draft → saved Question
 *
 * This keeps the editor forms decoupled from save logic.
 */

import type { Question } from '../../../types';
import { QuestionType } from '../../../types';
import {
    normalizeTrueFalseItems,
    normalizeDropdownBlanks,
} from '../utils/questionNormalizers';
import type {
    AnyEditorDraft,
    MCQEditorDraft,
    MultipleSelectEditorDraft,
    TrueFalseEditorDraft,
    ShortAnswerEditorDraft,
    MatchingEditorDraft,
    DragDropEditorDraft,
    OrderingEditorDraft,
    ImageQuestionEditorDraft,
    DropdownEditorDraft,
    UnderlineEditorDraft,
    CategorizationEditorDraft,
    WordScrambleEditorDraft,
    RiddleEditorDraft,
    ErrorCorrectionEditorDraft,
    Difficulty,
} from '../types/quiz-editor.types';

// ---------------------------------------------------------------------------
// Helper: safe cast to loose record
// ---------------------------------------------------------------------------
type Loose = Record<string, unknown>;
const r = (q: Question): Loose => q as unknown as Loose;

// ---------------------------------------------------------------------------
// questionToDraft — Question → EditorDraft
// ---------------------------------------------------------------------------

export function questionToDraft(question: Question): AnyEditorDraft {
    const q = r(question);
    const base = {
        question: String(q.question ?? q.mainQuestion ?? ''),
        difficulty: q.difficulty as Difficulty | undefined,
        image: typeof q.image === 'string' ? q.image : undefined,
        imageAlt: typeof q.imageAlt === 'string' ? q.imageAlt : (typeof q.image_alt === 'string' ? q.image_alt : undefined),
    };

    switch (question.type) {
        case QuestionType.MCQ: {
            const opts = Array.isArray(q.options) ? (q.options as string[]) : ['', '', '', ''];
            return {
                ...base,
                type: QuestionType.MCQ,
                options: opts,
                correctAnswer: String(q.correctAnswer ?? ''),
            } satisfies MCQEditorDraft;
        }

        case QuestionType.MULTIPLE_SELECT: {
            const opts = Array.isArray(q.options) ? (q.options as string[]) : ['', '', '', ''];
            const correct = Array.isArray(q.correctAnswers)
                ? (q.correctAnswers as string[])
                : [];
            return {
                ...base,
                type: QuestionType.MULTIPLE_SELECT,
                options: opts,
                correctAnswers: correct,
            } satisfies MultipleSelectEditorDraft;
        }

        case QuestionType.TRUE_FALSE:
            return {
                type: QuestionType.TRUE_FALSE,
                mainQuestion: String(q.mainQuestion ?? q.question ?? ''),
                items: normalizeTrueFalseItems(q.items),
                difficulty: q.difficulty as Difficulty | undefined,
            } satisfies TrueFalseEditorDraft;

        case QuestionType.SHORT_ANSWER:
            return {
                ...base,
                type: QuestionType.SHORT_ANSWER,
                correctAnswer: String(q.correctAnswer ?? ''),
            } satisfies ShortAnswerEditorDraft;

        case QuestionType.MATCHING: {
            const pairs = Array.isArray(q.pairs)
                ? (q.pairs as Array<{ left: string; right: string }>)
                : [];
            return {
                ...base,
                type: QuestionType.MATCHING,
                pairs,
            } satisfies MatchingEditorDraft;
        }

        case QuestionType.DRAG_DROP: {
            const blanks = Array.isArray(q.blanks) ? (q.blanks as string[]) : [];
            const distractors = Array.isArray(q.distractors)
                ? (q.distractors as string[])
                : [];
            return {
                ...base,
                type: QuestionType.DRAG_DROP,
                text: String(q.text ?? ''),
                blanks,
                distractors,
            } satisfies DragDropEditorDraft;
        }

        case QuestionType.ORDERING: {
            const items = Array.isArray(q.items)
                ? (q.items as string[])
                : [];
            const correctOrder = Array.isArray(q.correctOrder)
                ? (q.correctOrder as number[])
                : items.map((_, i) => i);
            return {
                ...base,
                type: QuestionType.ORDERING,
                items,
                correctOrder,
            } satisfies OrderingEditorDraft;
        }

        case QuestionType.IMAGE_QUESTION: {
            const opts = Array.isArray(q.options) ? (q.options as string[]) : ['', '', '', ''];
            const optImgs = Array.isArray(q.optionImages)
                ? (q.optionImages as string[])
                : [];
            return {
                ...base,
                type: QuestionType.IMAGE_QUESTION,
                image: String(q.image ?? ''),
                options: opts,
                correctAnswer: String(q.correctAnswer ?? ''),
                optionImages: optImgs,
            } satisfies ImageQuestionEditorDraft;
        }

        case QuestionType.DROPDOWN:
            return {
                ...base,
                type: QuestionType.DROPDOWN,
                text: String(q.text ?? ''),
                blanks: normalizeDropdownBlanks(q.blanks),
            } satisfies DropdownEditorDraft;

        case QuestionType.UNDERLINE: {
            const sentence = String(q.sentence ?? '');
            let words = Array.isArray(q.words) ? (q.words as string[]) : [];
            
            // Auto-fallback: If words is empty but sentence exists, split it
            if (words.length === 0 && sentence.trim().length > 0) {
                words = sentence.split(/\s+/).filter(w => w.length > 0);
            }

            const indexes = Array.isArray(q.correctWordIndexes)
                ? (q.correctWordIndexes as number[])
                : [];
            return {
                ...base,
                type: QuestionType.UNDERLINE,
                sentence,
                words,
                correctWordIndexes: indexes,
            } satisfies UnderlineEditorDraft;
        }

        case QuestionType.CATEGORIZATION: {
            const categories = Array.isArray(q.categories)
                ? (q.categories as Array<{ id: string; name: string }>)
                : [];
            const items = Array.isArray(q.items)
                ? (q.items as Array<{ id: string; content: string; categoryId: string }>)
                : [];
            return {
                ...base,
                type: QuestionType.CATEGORIZATION,
                categories,
                items,
            } satisfies CategorizationEditorDraft;
        }

        case QuestionType.WORD_SCRAMBLE: {
            const letters = Array.isArray(q.letters) ? (q.letters as string[]) : [];
            return {
                ...base,
                type: QuestionType.WORD_SCRAMBLE,
                letters,
                correctWord: String(q.correctWord ?? ''),
            } satisfies WordScrambleEditorDraft;
        }

        case QuestionType.RIDDLE: {
            const lines = Array.isArray(q.riddleLines) ? (q.riddleLines as string[]) : [];
            return {
                ...base,
                type: QuestionType.RIDDLE,
                riddleLines: lines.length > 0 ? lines : [''],
                correctAnswer: String(q.correctAnswer ?? ''),
                answerLabel: String(q.answerLabel ?? 'Đáp án'),
            } satisfies RiddleEditorDraft;
        }

        case QuestionType.ERROR_CORRECTION:
            return {
                ...base,
                type: QuestionType.ERROR_CORRECTION,
                passage: String(q.passage ?? ''),
                wrongWord: String(q.wrongWord ?? ''),
                correctWord: String(q.correctWord ?? ''),
            } satisfies ErrorCorrectionEditorDraft;

        default:
            // Fallback: treat as MCQ
            return {
                ...base,
                type: QuestionType.MCQ,
                options: ['', '', '', ''],
                correctAnswer: '',
            } satisfies MCQEditorDraft;
    }
}

// ---------------------------------------------------------------------------
// draftToQuestion — EditorDraft → Question (merged with original)
// ---------------------------------------------------------------------------

export function draftToQuestion(draft: AnyEditorDraft, original: Question): Question {
    const shared = {
        id: original.id,
        type: original.type,
        difficulty: draft.difficulty,
        imageAlt: (draft as { imageAlt?: string }).imageAlt,
    };

    switch (draft.type) {
        case QuestionType.MCQ:
            return {
                ...original,
                ...shared,
                question: draft.question,
                image: draft.image,
                options: draft.options,
                correctAnswer: draft.correctAnswer,
            } as Question;

        case QuestionType.MULTIPLE_SELECT:
            return {
                ...original,
                ...shared,
                question: draft.question,
                image: draft.image,
                options: draft.options,
                correctAnswers: draft.correctAnswers,
            } as Question;

        case QuestionType.TRUE_FALSE:
            return {
                ...original,
                ...shared,
                mainQuestion: draft.mainQuestion,
                question: draft.mainQuestion,
                items: draft.items,
            } as Question;

        case QuestionType.SHORT_ANSWER:
            return {
                ...original,
                ...shared,
                question: draft.question,
                image: draft.image,
                correctAnswer: draft.correctAnswer,
            } as Question;

        case QuestionType.MATCHING:
            return {
                ...original,
                ...shared,
                question: draft.question,
                image: draft.image,
                pairs: draft.pairs,
            } as Question;

        case QuestionType.DRAG_DROP:
            return {
                ...original,
                ...shared,
                question: draft.question,
                text: draft.text,
                blanks: draft.blanks,
                distractors: draft.distractors,
            } as Question;

        case QuestionType.ORDERING:
            return {
                ...original,
                ...shared,
                question: draft.question,
                items: draft.items,
                correctOrder: draft.correctOrder,
            } as Question;

        case QuestionType.IMAGE_QUESTION:
            return {
                ...original,
                ...shared,
                question: draft.question,
                image: draft.image,
                options: draft.options,
                correctAnswer: draft.correctAnswer,
                optionImages: draft.optionImages,
            } as Question;

        case QuestionType.DROPDOWN:
            return {
                ...original,
                ...shared,
                question: draft.question,
                text: draft.text,
                blanks: draft.blanks,
            } as Question;

        case QuestionType.UNDERLINE:
            return {
                ...original,
                ...shared,
                question: draft.question,
                sentence: draft.sentence,
                words: draft.words,
                correctWordIndexes: draft.correctWordIndexes,
            } as Question;

        case QuestionType.CATEGORIZATION:
            return {
                ...original,
                ...shared,
                question: draft.question,
                categories: draft.categories,
                items: draft.items,
            } as Question;

        case QuestionType.WORD_SCRAMBLE:
            return {
                ...original,
                ...shared,
                question: draft.question,
                letters: draft.letters,
                correctWord: draft.correctWord,
            } as Question;

        case QuestionType.RIDDLE:
            return {
                ...original,
                ...shared,
                question: draft.question,
                riddleLines: draft.riddleLines,
                correctAnswer: draft.correctAnswer,
                answerLabel: draft.answerLabel,
            } as Question;

        case QuestionType.ERROR_CORRECTION:
            return {
                ...original,
                ...shared,
                question: draft.question,
                passage: draft.passage,
                wrongWord: draft.wrongWord,
                correctWord: draft.correctWord,
            } as Question;

        default:
            return original;
    }
}
