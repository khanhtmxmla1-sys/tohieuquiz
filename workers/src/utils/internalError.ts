import { getRequestId, logStructured, type StructuredLogSink } from './logger';
import { jsonResponse } from './response';

export interface InternalErrorOptions {
    context: string;
    clientMessage?: string;
    logger?: StructuredLogSink;
}

export { getRequestId } from './logger';

export function internalErrorResponse(
    error: unknown,
    request: Request,
    options: InternalErrorOptions,
): Response {
    const requestId = getRequestId(request);
    const normalized = error instanceof Error ? error : new Error(String(error));
    logStructured('error', {
        event: 'worker_request_failed',
        requestId,
        route: new URL(request.url).pathname,
        method: request.method,
        status: 500,
        errorCode: 'INTERNAL_ERROR',
        context: options.context,
        errorName: normalized.name,
    }, options.logger);
    return jsonResponse({
        status: 'error',
        message: options.clientMessage || 'Internal server error',
        requestId,
    }, 500);
}
