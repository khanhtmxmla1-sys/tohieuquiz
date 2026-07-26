import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useQuizStore } from '../../stores/quizStore';

export const useQuizUrlSelection = () => {
    const location = useLocation();
    const quizStore = useQuizStore();

    useEffect(() => {
        if (location.pathname !== '/') return;

        const params = new URLSearchParams(location.search);
        const quizId = params.get('quizId') || params.get('quiz');
        if (!quizId || quizStore.selectedQuiz) return;

        const foundQuiz = quizStore.quizzes.find((quiz) => quiz.id === quizId);
        if (foundQuiz) {
            quizStore.selectQuiz(foundQuiz);
            quizStore.setView('student');
        }
    }, [location.pathname, location.search, quizStore]);
};
