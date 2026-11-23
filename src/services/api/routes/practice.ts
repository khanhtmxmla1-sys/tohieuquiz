import type { RouteRegistry } from '../types';

export const practiceRoutes: RouteRegistry = {
    get_practice_topics: {
        method: 'GET',
        auth: 'public', // Public practice content
        path: () => '/api/practice/topics',
    },
    get_practice_quiz: {
        method: 'GET',
        auth: 'public',
        path: () => '/api/practice',
        query: ({ topic, limit, delivery }) => {
            const q = new URLSearchParams();
            if (topic) q.append('topic', topic);
            if (limit) q.append('limit', limit);
            if (delivery) q.append('delivery', delivery);
            return q;
        },
    },
    grade_practice_quiz: {
        method: 'POST',
        auth: 'public',
        path: () => '/api/practice/grade',
        body: (_action, payload) => ({
            sessionToken: payload.sessionToken,
            answers: payload.answers,
            questionOrder: payload.questionOrder,
        }),
    },
};
