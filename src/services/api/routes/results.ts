import type { RouteRegistry } from '../types';

export const resultRoutes: RouteRegistry = {
    get_results: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/results',
    },
    get_results_summary: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/results/summary',
    },
    get_result_answers: {
        method: 'GET',
        auth: 'session',
        path: ({ resultId }) => `/api/results/${resultId}/answers`,
    },
    get_result_answers_bulk: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/results/answers/bulk',
    },
    get_result_skill_breakdown: {
        method: 'GET',
        auth: 'session',
        path: ({ resultId }) => `/api/results/${resultId}/skill-breakdown`,
    },
    get_result_weakness_profile: {
        method: 'GET',
        auth: 'session',
        path: ({ resultId }) => `/api/results/${resultId}/weakness-profile`,
    },
    submit_result: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/results',
    },
    delete_result: {
        method: 'DELETE',
        auth: 'session',
        path: ({ resultId }) => `/api/results/${resultId}`,
    },
    validate_answers: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/validate',
    },
};
