import type { RouteRegistry } from '../types';

export const quizRoutes: RouteRegistry = {
    get_quizzes: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/quizzes',
    },
    create_quiz: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/quizzes',
    },
    update_quiz: {
        method: 'PUT',
        auth: 'session',
        path: ({ id, quizId }) => `/api/quizzes/${id || quizId}`,
    },
    delete_quiz: {
        method: 'DELETE',
        auth: 'session',
        path: ({ id, quizId }) => `/api/quizzes/${id || quizId}`,
    },
    duplicate_quiz: {
        method: 'POST',
        auth: 'session',
        path: ({ quizId }) => `/api/quizzes/${quizId}/duplicate`,
    },
    get_questions: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/questions',
        query: ({ quizId }) => {
            const q = new URLSearchParams();
            if (quizId) q.append('quizId', quizId);
            return q;
        },
    },
};
