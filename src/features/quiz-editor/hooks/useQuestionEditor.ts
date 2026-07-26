/**
 * useQuestionEditor.ts
 *
 * Manages the complete lifecycle of editing a single question:
 *   - Opening / closing the edit modal
 *   - Initializing draft state from the question
 *   - Updating the draft as the user types
 *   - Saving the draft back to the quiz
 *
 * Replaces the 40+ useState hooks that were scattered in QuizPreview.tsx.
 */

import { useState, useCallback, useRef } from 'react';
import type { Quiz, Question } from '../../../types';
import { questionToDraft, draftToQuestion } from '../utils/questionDraftMapper';
import type { AnyEditorDraft } from '../types/quiz-editor.types';
import { normalizeQuestionMath, validateQuestionMath } from '../../../utils/questionMath';
import { showError } from '../../../utils/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseQuestionEditorOptions {
    quiz: Quiz | null;
    onUpdateQuestions?: (questions: Question[]) => void;
}

interface UseQuestionEditorReturn {
    /** The question currently being edited, or null if modal is closed. */
    editingQuestion: Question | null;
    /** Live draft state reflecting all user edits. */
    draft: AnyEditorDraft | null;
    /** Ref for the question-text <textarea> (for FormattingToolbar cursor positioning). */
    questionTextRef: React.RefObject<HTMLTextAreaElement>;
    /** Open the editor with a given question. */
    openEditor: (question: Question) => void;
    /** Close the editor and discard unsaved changes. */
    closeEditor: () => void;
    /** Update the entire draft (from individual editors). */
    setDraft: (updater: (prev: AnyEditorDraft) => AnyEditorDraft) => void;
    /** Save the current draft back to the quiz list. */
    saveEdit: () => void;
    /** Whether the modal is in "add new question" mode. */
    isAddMode: boolean;
    openAddEditor: (question: Question) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuestionEditor({
    quiz,
    onUpdateQuestions,
}: UseQuestionEditorOptions): UseQuestionEditorReturn {
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [draft, setDraftRaw] = useState<AnyEditorDraft | null>(null);
    const [isAddMode, setIsAddMode] = useState(false);
    const questionTextRef = useRef<HTMLTextAreaElement>(null);

    /** Open the editor for an existing question. */
    const openEditor = useCallback((question: Question) => {
        setEditingQuestion(question);
        setDraftRaw(questionToDraft(question));
        setIsAddMode(false);
    }, []);

    /** Open the editor for a new (placeholder) question. */
    const openAddEditor = useCallback((question: Question) => {
        setEditingQuestion(question);
        setDraftRaw(questionToDraft(question));
        setIsAddMode(true);
    }, []);

    /** Close the editor without saving. */
    const closeEditor = useCallback(() => {
        setEditingQuestion(null);
        setDraftRaw(null);
        setIsAddMode(false);
    }, []);

    /** Stable setter that merges partial updates. */
    const setDraft = useCallback(
        (updater: (prev: AnyEditorDraft) => AnyEditorDraft) => {
            setDraftRaw((prev) => (prev ? updater(prev) : prev));
        },
        [],
    );

    /**
     * Commits the current draft to the quiz.
     * For "add mode" it appends the question; for edit mode it replaces in-place.
     */
    const saveEdit = useCallback(() => {
        if (!draft || !editingQuestion || !quiz || !onUpdateQuestions) return;

        const rawQuestion = draftToQuestion(draft, editingQuestion);
        const updatedQuestion = normalizeQuestionMath(rawQuestion);
        const mathIssues = validateQuestionMath(updatedQuestion);
        if (mathIssues.length > 0) {
            const issue = mathIssues[0];
            showError(`LaTeX chưa hợp lệ tại ${issue.field || 'nội dung câu hỏi'}: ${issue.message}`, 6000);
            return;
        }

        let updatedQuestions: Question[];
        if (isAddMode) {
            updatedQuestions = [...quiz.questions, updatedQuestion];
        } else {
            updatedQuestions = quiz.questions.map((q) =>
                q.id === editingQuestion.id ? updatedQuestion : q,
            );
        }

        onUpdateQuestions(updatedQuestions);
        closeEditor();
    }, [draft, editingQuestion, quiz, onUpdateQuestions, isAddMode, closeEditor]);

    return {
        editingQuestion,
        draft,
        questionTextRef,
        openEditor,
        closeEditor,
        setDraft,
        saveEdit,
        isAddMode,
        openAddEditor,
    };
}
