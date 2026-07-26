import { useState } from 'react';
import type { Question } from '../../../types';
import { QuestionType } from '../../../types';
import { createManualQuestionDraft } from './questionTypes';

export const useQuestionAddFlow = (openAddEditor: (question: Question) => void) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [newQuestionType, setNewQuestionType] = useState<QuestionType>(QuestionType.MCQ);

    const startAdd = (type: QuestionType) => {
        setNewQuestionType(type);
        setShowAddModal(true);
    };

    const closeAddModal = () => setShowAddModal(false);

    const confirmAdd = () => {
        openAddEditor(createManualQuestionDraft(newQuestionType));
        setShowAddModal(false);
    };

    return {
        showAddModal,
        newQuestionType,
        setNewQuestionType,
        startAdd,
        closeAddModal,
        confirmAdd,
    };
};
