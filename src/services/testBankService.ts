import type { Question } from '../types';
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
        return data.items || [];
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
                    tags
                })
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
    }
};
