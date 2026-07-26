import { jsonResponse } from './response';

type ErrorLogger = Pick<Console, 'error'>;

export interface InternalErrorOptions {
    context: string;
    clientMessage?: string;
    logger?: ErrorLogger;
}

export function getRequestId(request: Request): string {
    const supplied = request.headers.get('x-request-id') || request.headers.get('cf-ray') || '';
    const normalized = supplied.trim().slice(0, 128);
    return normalized || crypto.randomUUID();
}

export function internalErrorResponse(
    error: unknown,
    request: Request,
    options: InternalErrorOptions,
): Response {
    const requestId = getRequestId(request);
    const logger = options.logger || console;
    logger.error(`[${options.context}] requestId=${requestId}`, error);
    return jsonResponse({
        status: 'error',
        message: options.clientMessage || 'Internal server error',
        requestId,
    }, 500);
}
