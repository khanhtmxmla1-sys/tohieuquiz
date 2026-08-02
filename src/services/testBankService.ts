import type { Question } from '../types';
import type {
    BulkImportResult,
    CreateQuestionBankItemInput,
    PatchQuestionBankItemInput,
    QuestionBankItem,
    QuestionBankListParams,
    QuestionBankListResponse,
} from '../features/question-bank/questionBank.types';
import { getWorkersApiBaseUrl } from './api/config';

// Keep protected test-bank traffic on the canonical API resolver; production uses same-origin /api.
const testBankUrl = (path: string): string => `${getWorkersApiBaseUrl()}${path}`;

export interface TestBankItem {
    id: string;
    teacher_id: string;
    question_data: Question;
    tags: string[];
    created_at: string;
}

export class QuestionBankApiError extends Error {
    readonly code: string;
    readonly status: number;
    readonly details?: unknown;

    constructor(message: string, code: string, status: number, details?: unknown) {
        super(message);
        this.name = 'QuestionBankApiError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

const readResponseBody = async (response: Response): Promise<unknown> => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

const requestQuestionBank = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    let response: Response;
    try {
        response = await fetch(testBankUrl(path), {
            credentials: 'include',
            ...init,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new QuestionBankApiError(
            `Không thể kết nối ngân hàng câu hỏi: ${message}`,
            'INTERNAL_ERROR',
            0,
        );
    }

    const body = await readResponseBody(response);
    if (!response.ok) {
        const payload = body && typeof body === 'object'
            ? body as { error?: { code?: string; message?: string; details?: unknown }; message?: string }
            : null;
        throw new QuestionBankApiError(
            payload?.error?.message || payload?.message || 'Yêu cầu ngân hàng câu hỏi thất bại.',
            payload?.error?.code || 'INTERNAL_ERROR',
            response.status,
            payload?.error?.details,
        );
    }

    return body as T;
};

const jsonInit = (method: string, body?: unknown): RequestInit => ({
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const buildListQuery = (params: QuestionBankListParams): string => {
    const searchParams = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(params)) {
        if (rawValue === undefined || rawValue === null) continue;
        if (typeof rawValue === 'string') {
            const value = rawValue.trim();
            if (!value) continue;
            searchParams.set(key, value);
            continue;
        }
        searchParams.set(key, String(rawValue));
    }
    const query = searchParams.toString();
    return query ? `?${query}` : '';
};

export const testBankService = {
    async getTestBank(teacherId: string): Promise<TestBankItem[]> {
        let response: Response;
        try {
            response = await fetch(
                testBankUrl(`/api/test-bank/teacher/${encodeURIComponent(teacherId)}`),
                { credentials: 'include' },
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Lỗi kết nối đến server ngân hàng câu hỏi: ${msg}`);
        }
        if (!response.ok) {
            throw new Error('Không thể tải ngân hàng câu hỏi');
        }
        const data = await response.json() as { items?: TestBankItem[] };
        return data.items ?? [];
    },

    async saveQuestion(teacherId: string, question: Question, tags: string[] = []): Promise<string> {
        const id = 'tb_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);

        let response: Response;
        try {
            response = await fetch(testBankUrl('/api/test-bank'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    teacher_id: teacherId,
                    question_data: question,
                    tags,
                }),
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Lỗi kết nối khi lưu câu hỏi: ${msg}`);
        }

        if (!response.ok) {
            throw new Error('Lỗi khi lưu câu hỏi vào ngân hàng');
        }

        const data = await response.json() as { id?: string };
        return data.id ?? id;
    },

    async deleteQuestion(id: string): Promise<boolean> {
        let response: Response;
        try {
            response = await fetch(testBankUrl(`/api/test-bank/${encodeURIComponent(id)}`), {
                method: 'DELETE',
                credentials: 'include',
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Lỗi kết nối khi xóa câu hỏi: ${msg}`);
        }

        if (!response.ok) {
            throw new Error('Lỗi khi xóa câu hỏi');
        }
        return true;
    },

    async listQuestionBank(params: QuestionBankListParams): Promise<QuestionBankListResponse> {
        return requestQuestionBank<QuestionBankListResponse>(
            `/api/test-bank${buildListQuery(params)}`,
        );
    },

    async getQuestionBankItem(id: string): Promise<QuestionBankItem> {
        const response = await requestQuestionBank<{ item: QuestionBankItem }>(
            `/api/test-bank/${encodeURIComponent(id)}`,
        );
        return response.item;
    },

    async createQuestionBankItem(input: CreateQuestionBankItemInput): Promise<QuestionBankItem> {
        const response = await requestQuestionBank<{ item: QuestionBankItem }>(
            '/api/test-bank',
            jsonInit('POST', input),
        );
        return response.item;
    },

    async patchQuestionBankItem(id: string, input: PatchQuestionBankItemInput): Promise<QuestionBankItem> {
        const response = await requestQuestionBank<{ item: QuestionBankItem }>(
            `/api/test-bank/${encodeURIComponent(id)}`,
            jsonInit('PATCH', input),
        );
        return response.item;
    },

    async archiveQuestionBankItem(id: string): Promise<boolean> {
        await requestQuestionBank<{ status: string }>(
            `/api/test-bank/${encodeURIComponent(id)}`,
            { method: 'DELETE', credentials: 'include' },
        );
        return true;
    },

    async bulkImportQuestionBank(items: CreateQuestionBankItemInput[]): Promise<BulkImportResult> {
        return requestQuestionBank<BulkImportResult>(
            '/api/test-bank/bulk',
            jsonInit('POST', { items }),
        );
    },

    async copyQuestionToPersonal(id: string): Promise<QuestionBankItem> {
        const response = await requestQuestionBank<{ item: QuestionBankItem }>(
            `/api/test-bank/${encodeURIComponent(id)}/copy-to-personal`,
            { method: 'POST', credentials: 'include' },
        );
        return response.item;
    },
};
