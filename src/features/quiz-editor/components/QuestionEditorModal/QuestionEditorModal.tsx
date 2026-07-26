import React from 'react';
import type { Question } from '../../../../types';
import type { AnyEditorDraft } from '../../types/quiz-editor.types';
import QuestionEditorForm from './QuestionEditorForm';

export interface QuestionEditorModalProps {
    editingQuestion: Question;
    draft: AnyEditorDraft;
    onDraftChange: (updater: (prev: AnyEditorDraft) => AnyEditorDraft) => void;
    onSave: () => void;
    onCancel: () => void;
    isGeneratingDistractors?: boolean;
    distractorCount?: number;
    distractorError?: string | null;
    onSetDistractorCount?: (n: number) => void;
    onGenerateDistractors?: (questionId: string, count: number, inEditMode: boolean) => void;
}

const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
    editingQuestion,
    draft,
    onDraftChange,
    onSave,
    onCancel,
    isGeneratingDistractors = false,
    distractorCount = 3,
    distractorError = null,
    onSetDistractorCount,
    onGenerateDistractors,
}) => (
    <div
        data-testid="question-editor-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md"
        onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Sửa câu hỏi"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
            <QuestionEditorForm
                editingQuestion={editingQuestion}
                draft={draft}
                onDraftChange={onDraftChange}
                onSave={onSave}
                onCancel={onCancel}
                mode="modal"
                isGeneratingDistractors={isGeneratingDistractors}
                distractorCount={distractorCount}
                distractorError={distractorError}
                onSetDistractorCount={onSetDistractorCount}
                onGenerateDistractors={onGenerateDistractors}
            />
        </div>
    </div>
);

export default React.memo(QuestionEditorModal);
