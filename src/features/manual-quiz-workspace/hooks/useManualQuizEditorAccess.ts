import { useEffect, useState } from 'react';
import { normalizeQuestionRow, useQuizStore } from '../../../../stores/quizStore';
import type { Quiz } from '../../../types';
import { getQuizEditorPayload } from '../services/quizEditorService';
import type { QuizEditorEditability } from '../types/manualQuizWorkspace.types';

export interface UseManualQuizEditorAccessOptions {
    quizId?: string;
    username: string | null;
    onEditorAccessErrorChange: (message: string) => void;
}

export interface ManualQuizEditorAccess {
    editability: QuizEditorEditability | null;
    editorAccessStatus: 'loading' | 'loaded' | 'error';
}

export const useManualQuizEditorAccess = ({
    quizId,
    username,
    onEditorAccessErrorChange,
}: UseManualQuizEditorAccessOptions): ManualQuizEditorAccess => {
    const [editability, setEditability] = useState<QuizEditorEditability | null>(null);
    const [editorAccessStatus, setEditorAccessStatus] = useState<'loading' | 'loaded' | 'error'>(
        quizId ? 'loading' : 'loaded',
    );

    useEffect(() => {
        if (!quizId || !username) return;
        let active = true;
        setEditorAccessStatus('loading');
        onEditorAccessErrorChange('');

        void getQuizEditorPayload(quizId)
            .then((payload) => {
                if (!active) return;
                const editorQuiz = {
                    ...payload.quiz,
                    questions: payload.questions.map(normalizeQuestionRow),
                } as Quiz;
                useQuizStore.setState((state) => ({
                    quizzes: state.quizzes.some((quiz) => quiz.id === editorQuiz.id)
                        ? state.quizzes.map((quiz) => quiz.id === editorQuiz.id ? editorQuiz : quiz)
                        : [...state.quizzes, editorQuiz],
                    selectedQuiz: state.selectedQuiz?.id === editorQuiz.id ? editorQuiz : state.selectedQuiz,
                }));
                setEditability(payload.editability);
                setEditorAccessStatus('loaded');
            })
            .catch((error: unknown) => {
                if (!active) return;
                onEditorAccessErrorChange(error instanceof Error ? error.message : 'Không thể tải quyền chỉnh sửa đề.');
                setEditorAccessStatus('error');
            });

        return () => {
            active = false;
        };
    }, [onEditorAccessErrorChange, quizId, username]);

    return { editability, editorAccessStatus };
};
