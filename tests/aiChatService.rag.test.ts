import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateChatResponse } from '../src/services/aiChatService';
import { callApi } from '../src/services/apiAdapter';

vi.mock('../src/services/apiAdapter', () => ({
    callApi: vi.fn(),
}));

const mockedCallApi = vi.mocked(callApi);

describe('aiChatService (RAG mode)', () => {
    beforeEach(() => {
        mockedCallApi.mockReset();
        localStorage.clear();
    });

    it('calls ask_help_rag and returns normalized answer', async () => {
        mockedCallApi.mockResolvedValue({
            status: 'success',
            data: {
                answer: '  Trả lời mẫu  ',
                confidence: 0.77,
            },
        } as any);

        const result = await generateChatResponse('Cách tạo đề?', []);

        expect(mockedCallApi).toHaveBeenCalledTimes(1);
        expect(mockedCallApi).toHaveBeenCalledWith(
            'ask_help_rag',
            expect.objectContaining({
                question: 'Cách tạo đề?',
                includeSources: false,
                sessionId: expect.any(String),
            })
        );
        expect(result).toEqual({
            answer: 'Trả lời mẫu',
            confidence: 0.77,
            sources: undefined,
            fallbackReason: undefined,
        });
    });

    it('passes includeSources=true and keeps returned sources', async () => {
        mockedCallApi.mockResolvedValue({
            status: 'success',
            data: {
                answer: 'Có nguồn',
                confidence: 0.91,
                fallbackReason: 'LOW_CONFIDENCE',
                sources: [
                    {
                        title: 'FAQ',
                        sourcePath: 'docs/help.md',
                        snippet: 'Nội dung',
                    },
                ],
            },
        } as any);

        const result = await generateChatResponse('Làm sao đổi mật khẩu?', [], { includeSources: true });

        expect(mockedCallApi).toHaveBeenCalledWith(
            'ask_help_rag',
            expect.objectContaining({
                includeSources: true,
            })
        );
        expect(result.sources?.length).toBe(1);
        expect(result.fallbackReason).toBe('LOW_CONFIDENCE');
    });

    it('throws readable error when API returns error status', async () => {
        mockedCallApi.mockResolvedValue({
            status: 'error',
            message: 'Service down',
        } as any);

        await expect(generateChatResponse('test', [])).rejects.toThrow('Service down');
    });
});
