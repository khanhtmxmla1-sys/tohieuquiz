import type { RouteRegistry } from '../types';

export const quizRoutes: RouteRegistry = {
    get_quizzes: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/quizzes',
    },
    verify_quiz_access_code: {
        method: 'POST',
        auth: 'public',
        path: ({ quizId }) => `/api/quizzes/access-verification/${encodeURIComponent(quizId)}`,
        body: (_action, { accessCode }) => ({ accessCode }),
    },
    create_quiz: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/quizzes',
    },
    get_quiz_editor: {
        method: 'GET',
        auth: 'session',
        path: ({ quizId }) => `/api/quizzes/${encodeURIComponent(quizId)}/editor`,
    },
    update_quiz: {
        method: 'PUT',
        auth: 'session',
        path: ({ id, quizId }) => `/api/quizzes/${id || quizId}`,
    },
    create_quiz_version: {
        method: 'POST',
        auth: 'session',
        path: ({ quizId }) => `/api/quizzes/${encodeURIComponent(quizId)}/versions`,
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
