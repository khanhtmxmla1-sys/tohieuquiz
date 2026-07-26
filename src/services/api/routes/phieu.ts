import type { RouteRegistry } from '../types';

export const phieuRoutes: RouteRegistry = {
    get_public_phieu: {
        method: 'GET',
        auth: 'public',
        path: ({ publicToken }) => `/api/phieu/public/${encodeURIComponent(String(publicToken || ''))}`,
    },
    upsert_phieu: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/phieu',
    },
    get_phieu_by_submission: {
        method: 'GET',
        auth: 'session',
        path: ({ submissionId, submission_id }) =>
            `/api/phieu/submissions/${encodeURIComponent(String(submissionId || submission_id || ''))}`,
    },
    get_result_phieu: {
        method: 'GET',
        auth: 'session',
        path: ({ resultId }) =>
            `/api/phieu/results/${encodeURIComponent(String(resultId || ''))}`,
    },
    upsert_result_phieu: {
        method: 'POST',
        auth: 'session',
        path: ({ resultId }) =>
            `/api/phieu/results/${encodeURIComponent(String(resultId || ''))}`,
        body: (_action, payload) => {
            const { resultId: _resultId, ...data } = payload;
            return data;
        },
    },
    publish_phieu_batch: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/phieu/batches',
    },
    deactivate_public_phieu_link: {
        method: 'POST',
        auth: 'session',
        path: ({ publicToken, public_token }) =>
            `/api/phieu/public-links/${encodeURIComponent(String(publicToken || public_token || ''))}/deactivate`,
    },
};
