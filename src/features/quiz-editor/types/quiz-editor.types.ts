/**
 * quiz-editor.types.ts
 *
 * Typed "editor draft" interfaces — one per question type.
 * These are the local state shapes used by each Editor component.
 * They mirror the domain Question types but are intentionally
 * separate so that editors can evolve independently.
 *
 * Domain types (MCQQuestion etc.) live in src/types/domain.types.ts.
 */

import type {
    QuestionType,
    TrueFalseItem,
    MatchingPair,
    DropdownBlank,
    CategoryGroup,
    CategorizationItem,
} from '../../../types';

// ---------------------------------------------------------------------------
// Common Fields
// ---------------------------------------------------------------------------

/** Difficulty shared by every question type. */
export type Difficulty = 1 | 2 | 3;

/** Fields common to all editor drafts. */
interface BaseEditorDraft {
    question: string;
    difficulty?: Difficulty;
    image?: string;
    imageAlt?: string;
}

// ---------------------------------------------------------------------------
// Per-type Editor Drafts
// ---------------------------------------------------------------------------

export interface MCQEditorDraft extends BaseEditorDraft {
    type: QuestionType.MCQ;
    options: string[];       // Always 4 strings (may be empty)
    correctAnswer: string;   // "A" | "B" | "C" | "D"
}

export interface MultipleSelectEditorDraft extends BaseEditorDraft {
    type: QuestionType.MULTIPLE_SELECT;
    options: string[];
    correctAnswers: string[];  // e.g. ["A", "C"]
}

export interface TrueFalseEditorDraft {
    type: QuestionType.TRUE_FALSE;
    mainQuestion: string;
    items: TrueFalseItem[];
    difficulty?: Difficulty;
}

export interface ShortAnswerEditorDraft extends BaseEditorDraft {
    type: QuestionType.SHORT_ANSWER;
    correctAnswer: string;
}

export interface MatchingEditorDraft extends BaseEditorDraft {
    type: QuestionType.MATCHING;
    pairs: MatchingPair[];
}

export interface DragDropEditorDraft extends BaseEditorDraft {
    type: QuestionType.DRAG_DROP;
    text: string;
    blanks: string[];
    distractors: string[];
}

export interface OrderingEditorDraft extends BaseEditorDraft {
    type: QuestionType.ORDERING;
    items: string[];
    correctOrder: number[];
}

export interface ImageQuestionEditorDraft extends BaseEditorDraft {
    type: QuestionType.IMAGE_QUESTION;
    image: string;           // Required for IMAGE_QUESTION
    options: string[];
    correctAnswer: string;
    optionImages?: string[];
}

export interface DropdownEditorDraft extends BaseEditorDraft {
    type: QuestionType.DROPDOWN;
    text: string;
    blanks: DropdownBlank[];
}

export interface UnderlineEditorDraft extends BaseEditorDraft {
    type: QuestionType.UNDERLINE;
    sentence: string;
    words: string[];
    correctWordIndexes: number[];
}

export interface CategorizationEditorDraft extends BaseEditorDraft {
    type: QuestionType.CATEGORIZATION;
    categories: CategoryGroup[];
    items: CategorizationItem[];
}

export interface WordScrambleEditorDraft extends BaseEditorDraft {
    type: QuestionType.WORD_SCRAMBLE;
    letters: string[];
    correctWord: string;
}

export interface RiddleEditorDraft extends BaseEditorDraft {
    type: QuestionType.RIDDLE;
    riddleLines: string[];
    correctAnswer: string;
    answerLabel: string;
}

export interface ErrorCorrectionEditorDraft extends BaseEditorDraft {
    type: QuestionType.ERROR_CORRECTION;
    passage: string;
    wrongWord: string;
    correctWord: string;
}

// ---------------------------------------------------------------------------
// Union Type
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all editor draft types.
 * useQuestionEditor.saveEdited() accepts this union and maps to the
 * correct domain Question shape.
 */
export type AnyEditorDraft =
    | MCQEditorDraft
    | MultipleSelectEditorDraft
    | TrueFalseEditorDraft
    | ShortAnswerEditorDraft
    | MatchingEditorDraft
    | DragDropEditorDraft
    | OrderingEditorDraft
    | ImageQuestionEditorDraft
    | DropdownEditorDraft
    | UnderlineEditorDraft
    | CategorizationEditorDraft
    | WordScrambleEditorDraft
    | RiddleEditorDraft
    | ErrorCorrectionEditorDraft;

// ---------------------------------------------------------------------------
// QuizPreview Props
// ---------------------------------------------------------------------------

/** Props interface for the refactored QuizPreview container. */
export interface QuizPreviewProps {
    quiz: import('../../../types').Quiz | null;
    onSave: () => void;
    isSaving?: boolean;
    onUpdateQuestions?: (questions: import('../../../types').Question[]) => void;
    onCreateManual?: () => void;
    onRegenerateQuestion?: (
        question: import('../../../types').Question,
    ) => Promise<import('../../../types').Question | null>;
}
