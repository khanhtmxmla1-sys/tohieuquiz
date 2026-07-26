import { getWorkersApiBaseUrl } from './api/config';

export interface MathTelemetryMetadata {
    quizId?: string;
    questionId?: string;
    questionType?: string;
    mathFormatVersion?: number;
}

export type MathRenderErrorCode = 'MATHJAX-MERROR' | 'TYPESET-FAILED' | 'DOM-SYNC-ERROR';

export interface MathTelemetryEvent extends MathTelemetryMetadata {
    errorCode: string;
    route?: string;
}

const clip = (value: unknown, max: number): string =>
    typeof value === 'string' ? value.trim().slice(0, max) : '';

const sanitizeRoute = (value: unknown): string => {
    const route = clip(value, 120);
    if (!route.startsWith('/')) return '';
    return route.split(/[?#]/, 1)[0];
};

/** Build the exact privacy-safe payload sent to the Worker. */
export const buildMathTelemetryPayload = (event: MathTelemetryEvent) => ({
    quizId: clip(event.quizId, 100),
    questionId: clip(event.questionId, 100),
    questionType: clip(event.questionType, 40).toUpperCase(),
    errorCode: clip(event.errorCode, 64).toUpperCase(),
    route: sanitizeRoute(event.route || (typeof window !== 'undefined' ? window.location.pathname : '')),
    mathFormatVersion: Number.isSafeInteger(event.mathFormatVersion)
        ? Number(event.mathFormatVersion)
        : 0,
});

const reported = new Set<string>();

export const reportMathTelemetry = (event: MathTelemetryEvent): void => {
    const payload = buildMathTelemetryPayload(event);
    if (!payload.errorCode) return;

    const dedupeKey = JSON.stringify(payload);
    if (reported.has(dedupeKey)) return;
    reported.add(dedupeKey);

    const url = `${getWorkersApiBaseUrl()}/api/math/telemetry`;
    const body = JSON.stringify(payload);
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
            if (sent) return;
        }
        void fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
            credentials: 'omit',
        }).catch(() => undefined);
    } catch {
        // Observability must never break quiz rendering.
    }
};

export const reportMathRenderEvent = async (event: MathTelemetryEvent): Promise<void> => {
    reportMathTelemetry(event);
};

export const resetMathTelemetryDedupeForTests = (): void => reported.clear();
