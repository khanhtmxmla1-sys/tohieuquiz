import React from 'react';
import type { Question } from '../../../types';
import type { AnyEditorDraft } from '../../../features/quiz-editor/types/quiz-editor.types';
import QuestionEditorModal from '../../../features/quiz-editor/components/QuestionEditorModal/QuestionEditorModal';
import type { useSmartDistractors } from '../../../features/quiz-editor/hooks/useSmartDistractors';

interface EditorOverlayProps {
    editingQuestion: Question | null;
    draft: AnyEditorDraft | null;
    isAddMode: boolean;
    onDraftChange: (updater: (draft: AnyEditorDraft) => AnyEditorDraft) => void;
    onSave: () => void;
    onClose: () => void;
    distractors: ReturnType<typeof useSmartDistractors>;
}

const EditorOverlay: React.FC<EditorOverlayProps> = ({
    editingQuestion,
    draft,
    onDraftChange,
    onSave,
    onClose,
    distractors,
}) => editingQuestion && draft ? (
    <QuestionEditorModal
        editingQuestion={editingQuestion}
        draft={draft}
        onDraftChange={onDraftChange}
        onSave={onSave}
        onCancel={onClose}
        isGeneratingDistractors={distractors.isGeneratingDistractors}
        distractorCount={distractors.distractorCount}
        distractorError={distractors.distractorError}
        onSetDistractorCount={distractors.setDistractorCount}
        onGenerateDistractors={(id, count) => distractors.generateDistractors(id, count, true)}
    />
) : null;

export default EditorOverlay;
