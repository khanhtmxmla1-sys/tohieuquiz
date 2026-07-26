export class ApiError extends Error {
    readonly status: number;
    readonly code?: string;

    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

export async function toApiError(response: Response): Promise<Error> {
    let errorMessage = `Lỗi kết nối Server: ${response.statusText}`;
    let backendMessage = '';
    let backendCode: string | undefined;

    try {
        const errData = await response.clone().json() as any;
        if (errData?.error && typeof errData.error === 'object') {
            if (typeof errData.error.message === 'string') backendMessage = errData.error.message;
            if (typeof errData.error.code === 'string') backendCode = errData.error.code;
        } else if (errData && typeof errData.message === 'string') {
            backendMessage = errData.message;
        }
    } catch {}

    if (response.status === 401 && (!backendMessage || backendMessage === 'Unauthorized')) {
        return new ApiError(
            'Không có quyền truy cập API (Authentication failed)',
            response.status,
            backendCode,
        );
    }

    if (backendMessage) return new ApiError(backendMessage, response.status, backendCode);

    const text = await response.text().catch(() => '');
    if (text) errorMessage += ` - ${text.substring(0, 100)}`;
    return new ApiError(errorMessage, response.status, backendCode);
}

export function normalizeNetworkError(error: unknown): Error {
    if (
        error instanceof TypeError &&
        error.message === 'Failed to fetch'
    ) {
        return new Error(
            'Không thể kết nối mạng hoặc lỗi CORS. Vui lòng kiểm tra kết nối.',
        );
    }
    return error instanceof Error ? error : new Error(String(error));
}
