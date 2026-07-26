import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useQuizStore } from '../../stores/quizStore';

const createMockResult = () => ({
    id: 'mock-123',
    studentName: 'Học Sinh Thử Nghiệm',
    studentClass: '4A',
    quizId: 'quiz-123',
    quizTitle: 'Bài tập ôn tập Toán 4',
    score: 8.5,
    correctCount: 17,
    totalQuestions: 20,
    submittedAt: new Date().toISOString(),
    timeTaken: 600,
    answers: {
        q1: { selected: 'A', correct: true },
        q2: { selected: 'B', correct: false },
        q3: { selected: 'C', correct: true },
    },
});

export const useTeacherEntry = () => {
    const authStore = useAuthStore();
    const quizStore = useQuizStore();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('autologin') === 'teacher' && !authStore.isLoggedIn) {
            authStore.loginSuccess('admin', 'Admin Test', true, '4A');
            if (quizStore.results.length === 0) quizStore.setResults([createMockResult()]);
            return;
        }

        if (authStore.isLoggedIn && quizStore.view === 'home' && location.pathname === '/') {
            quizStore.setView('teacher_dash');
        }
    }, [authStore.isLoggedIn, quizStore.view, location.pathname, quizStore, authStore]);
};
