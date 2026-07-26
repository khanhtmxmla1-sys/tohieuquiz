import type { ApiPayload } from './types';
import { getWorkersApiBaseUrl } from './config';
import { buildAuthHeaders } from './auth';
import { toApiError, normalizeNetworkError } from './errors';
import { resolveApiRoute } from './routeResolver';

function buildUrl(base: string, path: string, query?: URLSearchParams): string {
    const qs = query?.toString();
    return qs ? `${base}${path}?${qs}` : `${base}${path}`;
}

export async function executeApiAction<T = any>(
    action: string,
    payload: ApiPayload = {},
): Promise<T> {
    const route = resolveApiRoute(action);
    const requestPayload = { ...payload };
    delete requestPayload.__authToken;
    const path = route.path(requestPayload);
    const query = route.query?.(requestPayload);
    const url = buildUrl(getWorkersApiBaseUrl(), path, query);

    const authHeaders = buildAuthHeaders(route.auth, path);

    const requestInit: RequestInit = {
        method: route.method,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
        },
    };

    if (route.method !== 'GET' && route.method !== 'DELETE') {
        const body = route.body ? route.body(action, requestPayload) : requestPayload;
        requestInit.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, requestInit);

        if (!response.ok) {
            throw await toApiError(response);
        }

        return (await response.json()) as T;
    } catch (error: unknown) {
        throw normalizeNetworkError(error);
    }
}
