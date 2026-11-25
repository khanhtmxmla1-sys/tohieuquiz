import React, { Suspense } from 'react';
import { useQuizStore } from '../../stores/quizStore';
import { PageLoading } from './PageLoading';
import { StudentView } from './studentViewLazy';

export const StudentQuizView: React.FC = () => {
    const quizStore = useQuizStore();
    const selectedQuiz = quizStore.selectedQuiz;
    if (!selectedQuiz) return null;

    return (
        <Suspense fallback={<PageLoading />}>
            <StudentView quiz={selectedQuiz} onExit={() => quizStore.goHome()} onSaveResult={quizStore.submitResult} />
        </Suspense>
    );
};
