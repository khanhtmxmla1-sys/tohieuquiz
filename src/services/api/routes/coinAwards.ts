import type { ApiPayload, RouteRegistry } from '../types';

const encode = (value: unknown): string => encodeURIComponent(String(value ?? ''));

const strip = (...fields: string[]) => (_action: string, payload: ApiPayload): ApiPayload => {
    const body = { ...payload };
    fields.forEach((field) => delete body[field]);
    return body;
};

const historyQuery = (payload: ApiPayload): URLSearchParams => {
    const query = new URLSearchParams();
    if (payload.cursor !== undefined && payload.cursor !== null && payload.cursor !== '') {
        query.set('cursor', String(payload.cursor));
    }
    if (payload.limit !== undefined && payload.limit !== null && payload.limit !== '') {
        query.set('limit', String(payload.limit));
    }
    return query;
};

export const coinAwardRoutes: RouteRegistry = {
    preview_coin_award: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/coin-awards/preview',
    },
    create_coin_award: {
        method: 'POST',
        auth: 'session',
        path: () => '/api/coin-awards/batches',
    },
    list_coin_award_history: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/coin-awards/history',
        query: historyQuery,
    },
    reverse_coin_award: {
        method: 'POST',
        auth: 'session',
        path: ({ batchId }) => `/api/coin-awards/batches/${encode(batchId)}/reverse`,
        body: strip('batchId'),
    },
    adjust_coin_award: {
        method: 'POST',
        auth: 'session',
        path: ({ parentBatchId }) => `/api/coin-awards/batches/${encode(parentBatchId)}/adjustments`,
        body: strip('parentBatchId'),
    },
    get_coin_award_settings: {
        method: 'GET',
        auth: 'session',
        path: () => '/api/coin-awards/settings',
    },
    update_coin_award_settings: {
        method: 'PUT',
        auth: 'session',
        path: () => '/api/coin-awards/settings',
    },
    list_my_coin_award_history: {
        method: 'GET',
        auth: 'studentSession',
        path: () => '/api/student/coin-awards/history',
        query: historyQuery,
    },
};
