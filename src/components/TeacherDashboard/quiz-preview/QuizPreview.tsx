import React, { useState } from 'react';
import { Card } from '../../common';
import { QuestionType } from '../../../types';
import type { AnyEditorDraft } from '../../../features/quiz-editor/types/quiz-editor.types';
import { useQuestionEditor } from '../../../features/quiz-editor/hooks/useQuestionEditor';
import { useSmartDistractors } from '../../../features/quiz-editor/hooks/useSmartDistractors';
import type { QuizPreviewProps } from './types';
import { useQuestionRegeneration } from './useQuestionRegeneration';
import { useQuestionAddFlow } from './useQuestionAddFlow';
import { useQuestionBank } from './useQuestionBank';
import QuizPreviewToolbar from './QuizPreviewToolbar';
import QuestionList from './QuestionList';
import EmptyQuizPreview from './EmptyQuizPreview';
import QuizPreviewOverlays from './QuizPreviewOverlays';

const QuizPreview: React.FC<QuizPreviewProps> = ({
    quiz,
    onSave,
    isSaving = false,
    onUpdateQuestions,
    onStartManual,
    onRegenerateQuestion,
}) => {
    const editor = useQuestionEditor({ quiz, onUpdateQuestions });
    const distractors = useSmartDistractors({
        quiz,
        onUpdateQuestions,
        onUpdateEditOptions: (options) => {
            editor.setDraft((draft) => {
                if (
                    draft.type === QuestionType.MCQ ||
                    draft.type === QuestionType.MULTIPLE_SELECT ||
                    draft.type === QuestionType.IMAGE_QUESTION
                ) {
                    return { ...draft, options } as AnyEditorDraft;
                }
                return draft;
            });
        },
    });
    const regeneration = useQuestionRegeneration({ quiz, onUpdateQuestions, onRegenerateQuestion });
    const addFlow = useQuestionAddFlow(editor.openAddEditor);
    const bank = useQuestionBank({ quiz, onUpdateQuestions });
    const [showWorksheetModal, setShowWorksheetModal] = useState(false);

    return (
        <>
            <Card title="📋 Xem trước đề thi">
                {quiz ? (
                    <div className="space-y-4">
                        <QuizPreviewToolbar
                            quiz={quiz}
                            onSave={onSave}
                            isSaving={isSaving}
                            onOpenWorksheet={() => setShowWorksheetModal(true)}
                        />
                        <QuestionList
                            quiz={quiz}
                            onUpdateQuestions={onUpdateQuestions}
                            onEdit={editor.openEditor}
                            onRegenerate={regeneration.regenerateQuestion}
                            onSaveToBank={bank.saveQuestion}
                            onStartAdd={addFlow.startAdd}
                            onOpenTestBank={bank.openTestBank}
                            isGeneratingSingle={regeneration.isGeneratingSingle}
                            distractors={distractors}
                        />
                    </div>
                ) : (
                    <EmptyQuizPreview onStartManual={onStartManual} />
                )}
            </Card>
            <QuizPreviewOverlays
                quiz={quiz}
                showWorksheetModal={showWorksheetModal}
                onCloseWorksheet={() => setShowWorksheetModal(false)}
                editor={editor}
                distractors={distractors}
                addFlow={addFlow}
                bank={bank}
            />
        </>
    );
};

export default QuizPreview;
