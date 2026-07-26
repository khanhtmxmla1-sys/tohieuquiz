import { useState } from 'react';
import type { Quiz, Question } from '../../../types';
import { useAuthStore } from '../../../../stores/authStore';
import { testBankService } from '../../../services/testBankService';

interface QuestionBankOptions {
    quiz: Quiz | null;
    onUpdateQuestions?: (questions: Question[]) => void;
}

export const useQuestionBank = ({ quiz, onUpdateQuestions }: QuestionBankOptions) => {
    const { username } = useAuthStore();
    const [showTestBank, setShowTestBank] = useState(false);

    const addQuestion = (question: Question) => {
        if (onUpdateQuestions && quiz) {
            onUpdateQuestions([...quiz.questions, question]);
        }
    };

    const saveQuestion = async (question: Question) => {
        if (!username) return;
        await testBankService.saveQuestion(username, question, [question.type]);
    };

    return {
        username,
        showTestBank,
        openTestBank: () => setShowTestBank(true),
        closeTestBank: () => setShowTestBank(false),
        addQuestion,
        saveQuestion,
    };
};
