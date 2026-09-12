import type { ApiPayload } from './types';
import { getWorkersApiBaseUrl } from './config';
import { buildAuthHeaders } from './auth';
import { ApiError, toApiError, normalizeNetworkError } from './errors';
import { resolveApiRoute } from './routeResolver';
import { cacheService } from '../CacheService';

const AUTH_REQUEST_TIMEOUT_MS = 15_000;

// Keep the guard limited to short-lived authentication/session requests. Long-running
// authenticated work such as AI generation must retain its own request lifetime.
const AUTH_REQUEST_ACTIONS = new Set([
    'login',
    'student_login',
    'activate_parent_link',
    'parent_login',
    'get_account_profile',
    'student_profile',
    'get_parent_session',
    'logout',
    'parent_logout',
    'logout_all',
    'change_password',
    'change_student_password',
    'get_account_passkeys',
    'begin_passkey_registration',
    'finish_passkey_registration',
    'begin_passkey_authentication',
    'finish_passkey_authentication',
    'get_account_sessions',
    'get_account_security_events',
    'revoke_account_session',
    'revoke_all_account_sessions',
    'revoke_account_passkey',
]);

// These endpoints can set or clear the shared auth_token cookie. Serializing them
// prevents a delayed logout response from clearing a cookie issued by a later login.
const AUTH_COOKIE_MUTATION_ACTIONS = new Set([
    'login',
    'student_login',
    'logout',
    'logout_all',
    'change_password',
    'change_student_password',
    'finish_passkey_authentication',
    'revoke_account_session',
    'revoke_all_account_sessions',
]);

let authCookieMutationTail: Promise<void> = Promise.resolve();
let pendingLogout: Promise<unknown> | null = null;

function withAuthRequestTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            controller.abort();
            reject(new ApiError(
                'Yêu cầu xác thực đã quá thời gian chờ. Vui lòng thử lại.',
                408,
                'AUTH_REQUEST_TIMEOUT',
            ));
        }, AUTH_REQUEST_TIMEOUT_MS);
    });

    return Promise.race([operation(controller.signal), timeout]).finally(() => {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
    });
}

function enqueueAuthCookieMutation<T>(action: string, operation: () => Promise<T>): Promise<T> {
    if (action === 'logout' && pendingLogout) return pendingLogout as Promise<T>;
    if (action !== 'logout') pendingLogout = null;

    const queued = authCookieMutationTail.then(operation, operation);
    // Always resolve the tail so one failed request cannot poison later auth actions.
    authCookieMutationTail = queued.then(() => undefined, () => undefined);

    if (action !== 'logout') return queued;

    const tracked = queued.finally(() => {
        if (pendingLogout === tracked) pendingLogout = null;
    });
    pendingLogout = tracked;
    return tracked;
}

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

    if (route.method === 'DELETE' && typeof requestPayload.requestId === 'string'
        && requestPayload.requestId.trim()) {
        (requestInit.headers as Record<string, string>)['x-request-id'] = requestPayload.requestId.trim();
    }

    if (route.method !== 'GET' && route.method !== 'DELETE') {
        const body = route.body ? route.body(action, requestPayload) : requestPayload;
        requestInit.body = JSON.stringify(body);
    }

    const performRequest = async (signal?: AbortSignal): Promise<T> => {
        const response = await fetch(url, signal ? { ...requestInit, signal } : requestInit);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) cacheService.clear();
            throw await toApiError(response);
        }

        return (await response.json()) as T;
    };

    const perform = () => AUTH_REQUEST_ACTIONS.has(action)
        ? withAuthRequestTimeout((signal) => performRequest(signal))
        : performRequest();

    try {
        return AUTH_COOKIE_MUTATION_ACTIONS.has(action)
            ? await enqueueAuthCookieMutation(action, perform)
            : await perform();
    } catch (error: unknown) {
        throw normalizeNetworkError(error);
    }
}
