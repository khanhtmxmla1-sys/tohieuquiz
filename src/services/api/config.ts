import { WORKERS_API_URL } from '../../config/constants';

export const REMOTE_WORKERS_API_URL = '';

interface WorkersApiResolutionInput {
    configuredUrl: string;
    isDev: boolean;
    hostname?: string;
}

export function resolveWorkersApiBaseUrl({
    configuredUrl,
    isDev,
    hostname,
}: WorkersApiResolutionInput): string {
    const normalizedUrl = configuredUrl.trim().replace(/\/+$/, '');
    const normalizedHostname = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
    const isVercelPreview = /\.vercel\.app$/i.test(normalizedHostname);
    const isParentPortal = normalizedHostname.startsWith('phuhuynh.');

    if (!normalizedUrl || isVercelPreview || isParentPortal) return '';
    if (isDev && REMOTE_WORKERS_API_URL && normalizedUrl === REMOTE_WORKERS_API_URL) return '';
    return normalizedUrl;
}

export function getWorkersApiBaseUrl(): string {
    return resolveWorkersApiBaseUrl({
        configuredUrl: WORKERS_API_URL,
        isDev: import.meta.env.DEV,
        hostname: typeof window === 'undefined' ? undefined : window.location.hostname,
    });
}
