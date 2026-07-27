import { useEffect } from 'react';
import { useQuizStore } from '../../stores/quizStore';

export const useLoadQuizzes = () => {
    const loadQuizzes = useQuizStore((state) => state.loadQuizzes);

    useEffect(() => {
        void loadQuizzes();

    }, []);
};
