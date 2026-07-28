export interface AppError {
  code: string;
  message: string;
  status: number;
  requestId?: string;
  retryable: boolean;
}

const retryableStatus = (status: number): boolean => status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;

const fallbackMessage = (status: number): string => {
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy dữ liệu được yêu cầu.';
  if (status === 409) return 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.';
  if (status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
  if (status >= 500) return 'Hệ thống tạm thời chưa sẵn sàng. Vui lòng thử lại.';
  return 'Không thể hoàn tất yêu cầu.';
};

const safeMessage = (value: unknown, status: number): string => {
  if (typeof value !== 'string') return fallbackMessage(status);
  const message = value.trim();
  if (!message || message.length > 300 || /<\/?(?:html|script|body)/i.test(message)) return fallbackMessage(status);
  return message;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(message: string, status: number, code = 'API_ERROR', requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryableStatus(status);
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  let backendMessage: unknown;
  let backendCode: unknown;
  let backendRequestId: unknown;
  try {
    const payload = await response.clone().json() as Record<string, unknown>;
    const envelope = payload.error && typeof payload.error === 'object'
      ? payload.error as Record<string, unknown>
      : payload;
    backendMessage = envelope.message;
    backendCode = envelope.code;
    backendRequestId = envelope.requestId ?? payload.requestId;
  } catch {
    // Non-JSON error bodies are deliberately not surfaced to the browser.
  }
  const requestId = typeof backendRequestId === 'string'
    ? backendRequestId
    : response.headers.get('x-request-id') || undefined;
  return new ApiError(
    safeMessage(backendMessage, response.status),
    response.status,
    typeof backendCode === 'string' ? backendCode : `HTTP_${response.status}`,
    requestId,
  );
}

export function normalizeNetworkError(error: unknown): ApiError | Error {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError && /fetch|network|cors/i.test(error.message)) {
    return new ApiError('Không thể kết nối mạng. Vui lòng kiểm tra kết nối rồi thử lại.', 0, 'NETWORK_ERROR');
  }
  return error instanceof Error ? error : new Error('Đã xảy ra lỗi không xác định.');
}

export function toAppError(error: unknown): AppError {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      requestId: error.requestId,
      retryable: error.retryable,
    };
  }
  return {
    code: 'CLIENT_ERROR',
    message: 'Ứng dụng gặp sự cố. Vui lòng thử lại.',
    status: 0,
    retryable: true,
  };
}
