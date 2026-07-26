import React from 'react';
import type { Quiz } from '../../../types';
import WorksheetExportModal from '../WorksheetExportModal';
import { TestBankModal } from '../../../features/quiz-editor/components/TestBankModal';
import type { useQuestionEditor } from '../../../features/quiz-editor/hooks/useQuestionEditor';
import type { useSmartDistractors } from '../../../features/quiz-editor/hooks/useSmartDistractors';
import type { useQuestionAddFlow } from './useQuestionAddFlow';
import type { useQuestionBank } from './useQuestionBank';
import AddQuestionModal from './AddQuestionModal';
import EditorOverlay from './EditorOverlay';

interface QuizPreviewOverlaysProps {
    quiz: Quiz | null;
    showWorksheetModal: boolean;
    onCloseWorksheet: () => void;
    editor: ReturnType<typeof useQuestionEditor>;
    distractors: ReturnType<typeof useSmartDistractors>;
    addFlow: ReturnType<typeof useQuestionAddFlow>;
    bank: ReturnType<typeof useQuestionBank>;
}

const QuizPreviewOverlays: React.FC<QuizPreviewOverlaysProps> = ({
    quiz,
    showWorksheetModal,
    onCloseWorksheet,
    editor,
    distractors,
    addFlow,
    bank,
}) => (
    <>
        {showWorksheetModal && quiz && (
            <WorksheetExportModal quiz={quiz} onClose={onCloseWorksheet} />
        )}
        <TestBankModal
            isOpen={bank.showTestBank}
            onClose={bank.closeTestBank}
            teacherId={bank.username || ''}
            onAddQuestion={bank.addQuestion}
        />
        <AddQuestionModal
            isOpen={addFlow.showAddModal}
            questionType={addFlow.newQuestionType}
            onQuestionTypeChange={addFlow.setNewQuestionType}
            onClose={addFlow.closeAddModal}
            onConfirm={addFlow.confirmAdd}
        />
        <EditorOverlay
            editingQuestion={editor.editingQuestion}
            draft={editor.draft}
            isAddMode={editor.isAddMode}
            onDraftChange={editor.setDraft}
            onSave={editor.saveEdit}
            onClose={editor.closeEditor}
            distractors={distractors}
        />
    </>
);

export default QuizPreviewOverlays;
