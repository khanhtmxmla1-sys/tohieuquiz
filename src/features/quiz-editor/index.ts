/**
 * index.ts — Public API for the quiz-editor feature module.
 *
 * All consumers (TeacherDashboard, tests, etc.) should import from here.
 * Internal implementation details are NOT re-exported.
 */

// --- Utils ---
export {
    toBoolean,
    normalizeTrueFalseItems,
    normalizeDropdownBlanks,
    fixReorderQuestion,
} from './utils/questionNormalizers';

export {
    getTypeLabel,
    supportsDistractors,
    insertTags,
    getDifficultyLabel,
    getDifficultyColorClass,
} from './utils/questionHelpers';

// --- Types ---
export type {
    Difficulty,
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
    QuizPreviewProps,
} from './types/quiz-editor.types';

// --- Hooks ---
export { useSmartDistractors } from './hooks/useSmartDistractors';
export { useQuizEditorActions } from './hooks/useQuizEditorActions';

// --- Components ---
export { QuestionCard } from './components/QuestionCard';
export type { QuestionCardProps } from './components/QuestionCard';

export { QuestionEditorModal } from './components/QuestionEditorModal';
export type { QuestionEditorModalProps } from './components/QuestionEditorModal';

// --- Phase 3: Editor Hooks & Mappers ---
export { useQuestionEditor } from './hooks/useQuestionEditor';
export { questionToDraft, draftToQuestion } from './utils/questionDraftMapper';
