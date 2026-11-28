import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import { useQuizGeneration } from '../src/features/quiz-generator/hooks/useQuizGeneration';
import type { OcrDocument } from '../src/services/ai/schemas/ocrDocumentSchema';

const mocks = vi.hoisted(() => ({
    requestServerQuizGeneration: vi.fn(),
    generateQuiz: vi.fn(),
    extractTextFromPdf: vi.fn(),
    showError: vi.fn(),
    useTeacherAiQuota: vi.fn(),
    createAiAction: vi.fn(),
}));

vi.mock('../src/services/ai/serverQuizGenerationClient', () => ({
    requestServerQuizGeneration: mocks.requestServerQuizGeneration,
}));

vi.mock('../src/services/geminiService', () => ({
    AI_CORE_SUBJECT_IDS: [
        'toan',
        'tieng-viet',
        'tieng-anh',
        'tu-nhien-xa-hoi',
        'tin-hoc',
    ],
    extractTextFromPdf: mocks.extractTextFromPdf,
    generateQuiz: mocks.generateQuiz,
}));

vi.mock('../src/utils/toast', () => ({
    showError: mocks.showError,
}));

vi.mock('../src/features/quiz-generator/hooks/useTeacherAiQuota', () => ({
    useTeacherAiQuota: mocks.useTeacherAiQuota,
}));

vi.mock('../src/services/ai/aiAction', () => ({
    createAiAction: mocks.createAiAction,
}));

const createForm = (overrides: Record<string, unknown> = {}) => {
    const form = {
        quizMode: 'exam' as const,
        aiProvider: 'llm-mux' as const,
        topic: 'Phép nhân',
        classLevel: '3',
        content: 'Nội dung tham khảo.',
        quizTitle: 'Đề Toán máy chủ',
        category: 'math',
        tags: [],
        customPrompt: '',
        promptProfile: {
            useThongTu27: true,
            learnerMode: 'default' as const,
        },
        quizIntent: 'EXAM' as const,
        selectedTypes: {
            [QuestionType.MCQ]: true,
        },
        questionTypeAllocations: [
            { type: QuestionType.MCQ, count: 2 },
        ],
        difficultyLevels: {
            level1: 0,
            level2: 2,
            level3: 0,
        },
        imageLibrary: [],
        uploadedFile: null,
        ocrDocument: null as OcrDocument | null,
        selectedOcrPageNumbers: [] as number[],
        autoGenerateSvg: false,
        manualTimeLimit: '',
        requireCode: false,
        accessCode: '',
        showOnHome: true,
        setQuizMode: vi.fn(),
        setQuizIntent: vi.fn(),
        clearOcrDocument: vi.fn(),
        applyOcrDocument: vi.fn(),
        setAiDetectedCategory: vi.fn(),
        setAiDetectedLesson: vi.fn(),
        setAiSuggestedTags: vi.fn(),
        setGeneratedQuiz: vi.fn(),
    };
    Object.assign(form, overrides);
    return form;
};

const createOcrDocument = (): OcrDocument => ({
    pages: [
        { pageNumber: 1, text: `OCR TRANG 1 ${'nội dung '.repeat(20)}` },
        { pageNumber: 2, text: `OCR TRANG 2 ${'bổ sung '.repeat(20)}` },
        { pageNumber: 3, text: `OCR TRANG 3 ${'kiến thức '.repeat(20)}` },
    ],
    warnings: [],
    wasTruncated: false,
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('useQuizGeneration server path', () => {
    it('uses one server request for a flagged V3 full generation', async () => {
        const form = createForm();
        mocks.createAiAction.mockReturnValue({ actionId: 'hook-action-0001' });
        mocks.useTeacherAiQuota.mockReturnValue({
            aiUsageCount: 0,
            aiUsageRemaining: 100,
            hasAiQuota: true,
            dailyAiLimit: 100,
            refresh: vi.fn().mockResolvedValue(undefined),
        });
        mocks.requestServerQuizGeneration.mockResolvedValue({
            status: 'success',
            actionId: 'hook-action-0001',
            source: 'system',
            promptVersion: 'ai-blueprint-v3',
            blueprintVersion: 3,
            orchestratorVersion: 'server-quiz-v1',
            quiz: {
                promptVersion: 'ai-blueprint-v3',
                blueprintVersion: 3,
                title: 'Đề Toán máy chủ',
                questions: [],
            },
        });

        const { result } = renderHook(() => useQuizGeneration({
            form: form as never,
            editingQuiz: null,
            isTeacherAccount: false,
            username: null,
            teacherName: 'Teacher',
            aiQuizV2Enabled: true,
            aiBlueprintV3Enabled: true,
            aiSvgDiagramsEnabled: false,
            serverQuizGenerationEnabled: true,
        }));

        await act(async () => {
            await result.current.handleGenerate();
        });

        expect(mocks.requestServerQuizGeneration).toHaveBeenCalledTimes(1);
        expect(mocks.generateQuiz).not.toHaveBeenCalled();
        expect(mocks.requestServerQuizGeneration).toHaveBeenCalledWith(
            expect.objectContaining({
                actionId: 'hook-action-0001',
                source: 'system',
                title: 'Đề Toán máy chủ',
                topic: 'Phép nhân',
                classLevel: '3',
                sourceMode: 'TOPIC',
                questionCount: 2,
                typeAllocations: [{ type: 'MCQ', count: 2 }],
            }),
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        expect(mocks.requestServerQuizGeneration.mock.calls[0][0]).not.toHaveProperty('model');
        expect(mocks.requestServerQuizGeneration.mock.calls[0][0]).not.toHaveProperty('messages');
        expect(mocks.requestServerQuizGeneration.mock.calls[0][0]).not.toHaveProperty('apiKey');
        expect(form.setGeneratedQuiz).toHaveBeenCalledTimes(1);
        expect(result.current.generationStep).toBe('completed');
    });

    it('keeps trial generation on the client path when server and V3 flags are enabled', async () => {
        const form = createForm();
        mocks.createAiAction.mockReturnValue({ actionId: 'trial-action-0001' });
        mocks.useTeacherAiQuota.mockReturnValue({
            aiUsageCount: 0,
            aiUsageRemaining: 100,
            hasAiQuota: true,
            dailyAiLimit: 100,
            refresh: vi.fn().mockResolvedValue(undefined),
        });
        mocks.generateQuiz.mockResolvedValue({ title: 'Đề dùng thử', questions: [] });

        const { result } = renderHook(() => useQuizGeneration({
            form: form as never,
            editingQuiz: null,
            isTeacherAccount: false,
            username: null,
            teacherName: 'Teacher',
            aiQuizV2Enabled: true,
            aiBlueprintV3Enabled: true,
            aiSvgDiagramsEnabled: false,
            serverQuizGenerationEnabled: true,
        }));

        await act(async () => {
            await result.current.handleGenerateTrial();
        });

        expect(mocks.requestServerQuizGeneration).not.toHaveBeenCalled();
        expect(mocks.generateQuiz).toHaveBeenCalledTimes(1);
        expect(mocks.generateQuiz.mock.calls[0][4]).toEqual(
            expect.objectContaining({ questionCount: 2 }),
        );
        expect(form.setGeneratedQuiz).toHaveBeenCalledWith(
            expect.objectContaining({
                aiGeneration: expect.objectContaining({ generationKind: 'trial' }),
            }),
        );
    });

    it.each([
        { serverQuizGenerationEnabled: false, aiBlueprintV3Enabled: true },
        { serverQuizGenerationEnabled: true, aiBlueprintV3Enabled: false },
    ])('keeps the client path when a server flag is off (%o)', async ({
        serverQuizGenerationEnabled,
        aiBlueprintV3Enabled,
    }) => {
        const form = createForm();
        mocks.createAiAction.mockReturnValue({ actionId: 'client-action-0001' });
        mocks.useTeacherAiQuota.mockReturnValue({
            aiUsageCount: 0,
            aiUsageRemaining: 100,
            hasAiQuota: true,
            dailyAiLimit: 100,
            refresh: vi.fn().mockResolvedValue(undefined),
        });
        mocks.generateQuiz.mockResolvedValue({ title: 'Đề phía client', questions: [] });

        const { result } = renderHook(() => useQuizGeneration({
            form: form as never,
            editingQuiz: null,
            isTeacherAccount: false,
            username: null,
            teacherName: 'Teacher',
            aiQuizV2Enabled: true,
            aiBlueprintV3Enabled,
            aiSvgDiagramsEnabled: false,
            serverQuizGenerationEnabled,
        }));

        await act(async () => {
            await result.current.handleGenerate();
        });

        expect(mocks.requestServerQuizGeneration).not.toHaveBeenCalled();
        expect(mocks.generateQuiz).toHaveBeenCalledTimes(1);
    });

    it('filters zero allocation counts before building a server request', async () => {
        const form = createForm({
            questionTypeAllocations: [
                { type: QuestionType.MCQ, count: 2 },
                { type: QuestionType.TRUE_FALSE, count: 0 },
            ],
        });
        mocks.createAiAction.mockReturnValue({ actionId: 'filter-action-0001' });
        mocks.useTeacherAiQuota.mockReturnValue({
            aiUsageCount: 0,
            aiUsageRemaining: 100,
            hasAiQuota: true,
            dailyAiLimit: 100,
            refresh: vi.fn().mockResolvedValue(undefined),
        });
        mocks.requestServerQuizGeneration.mockResolvedValue({
            status: 'success',
            actionId: 'filter-action-0001',
            source: 'system',
            quiz: { title: 'Đề lọc', questions: [] },
        });

        const { result } = renderHook(() => useQuizGeneration({
            form: form as never,
            editingQuiz: null,
            isTeacherAccount: false,
            username: null,
            teacherName: 'Teacher',
            aiQuizV2Enabled: true,
            aiBlueprintV3Enabled: true,
            aiSvgDiagramsEnabled: false,
            serverQuizGenerationEnabled: true,
        }));

        await act(async () => {
            await result.current.handleGenerate();
        });

        expect(mocks.requestServerQuizGeneration.mock.calls[0][0].typeAllocations)
            .toEqual([{ type: 'MCQ', count: 2 }]);
    });

    it('rejects unsupported positive server allocation and returns to idle', async () => {
        const form = createForm({
            selectedTypes: {
                [QuestionType.MCQ]: true,
                [QuestionType.ERROR_CORRECTION]: true,
            },
            questionTypeAllocations: [
                { type: QuestionType.MCQ, count: 1 },
                { type: QuestionType.ERROR_CORRECTION, count: 1 },
            ],
        });
        const refresh = vi.fn().mockResolvedValue(undefined);
        mocks.createAiAction.mockReturnValue({ actionId: 'unsupported-action-0001' });
        mocks.useTeacherAiQuota.mockReturnValue({
            aiUsageCount: 0,
            aiUsageRemaining: 100,
            hasAiQuota: true,
            dailyAiLimit: 100,
            refresh,
        });

        const { result } = renderHook(() => useQuizGeneration({
            form: form as never,
            editingQuiz: null,
            isTeacherAccount: false,
            username: null,
            teacherName: 'Teacher',
            aiQuizV2Enabled: true,
            aiBlueprintV3Enabled: true,
            aiSvgDiagramsEnabled: false,
            serverQuizGenerationEnabled: true,
        }));

        await act(async () => {
            await result.current.handleGenerate();
        });

        expect(mocks.requestServerQuizGeneration).not.toHaveBeenCalled();
        expect(mocks.generateQuiz).not.toHaveBeenCalled();
        expect(mocks.showError).toHaveBeenCalledWith(
            'Dạng câu đã chọn chưa được hỗ trợ bởi tạo đề máy chủ.',
        );
        expect(result.current.generationStep).toBe('idle');
        expect(refresh).toHaveBeenCalled();
    });

    it('preserves server result metadata and editing identity while mapping a result', async () => {
        const form = createForm({
            manualTimeLimit: 0,
            requireCode: true,
            accessCode: 'abc',
            category: 'manual-category',
            tags: ['manual-tag'],
        });
        mocks.createAiAction.mockReturnValue({ actionId: 'editing-action-0001' });
        mocks.useTeacherAiQuota.mockReturnValue({
            aiUsageCount: 0,
            aiUsageRemaining: 100,
            hasAiQuota: true,
            dailyAiLimit: 100,
            refresh: vi.fn().mockResolvedValue(undefined),
        });
        mocks.requestServerQuizGeneration.mockResolvedValue({
            status: 'success',
            actionId: 'editing-action-0001',
            source: 'system',
            quiz: {
                title: '',
                timeLimit: 20,
                detectedCategory: 'toan',
                detectedLesson: '  detected lesson  ',
                suggestedTags: ['detected-tag'],
                questions: [
                    { id: 'existing-question', type: QuestionType.MCQ, question: 'Có sẵn' },
                    { type: QuestionType.MCQ, question: 'Thiếu id' },
                ],
            },
        });

        const { result } = renderHook(() => useQuizGeneration({
            form: form as never,
            editingQuiz: {
                id: 'existing-quiz',
                createdAt: '2026-01-01T00:00:00.000Z',
                createdBy: 'original-teacher',
            } as never,
            isTeacherAccount: false,
            username: null,
            teacherName: 'Teacher',
            aiQuizV2Enabled: true,
            aiBlueprintV3Enabled: true,
            aiSvgDiagramsEnabled: false,
            serverQuizGenerationEnabled: true,
        }));

        await act(async () => {
            await result.current.handleGenerate();
        });

        const generatedQuiz = form.setGeneratedQuiz.mock.calls[0][0];
        expect(generatedQuiz).toMatchObject({
            id: 'existing-quiz',
            title: 'Đề Toán máy chủ',
            createdAt: '2026-01-01T00:00:00.000Z',
            createdBy: 'original-teacher',
            timeLimit: 0,
            accessCode: 'ABC',
            category: 'manual-category',
            tags: ['manual-tag'],
            detectedCategory: 'toan',
            detectedLesson: 'detected lesson',
            suggestedTags: ['detected-tag'],
        });
        expect(generatedQuiz.questions[0].id).toBe('existing-question');
        expect(generatedQuiz.questions[1].id).toMatch(/^q-/);
    });

    it('keeps selected OCR pages and content when server generation follows V2 preview', async () => {
        const form = createForm({
            quizMode: 'pdf',
            uploadedFile: new File(['pdf'], 'nguon.pdf', { type: 'application/pdf' }),
        });
        form.applyOcrDocument.mockImplementation((document: OcrDocument) => {
            form.ocrDocument = document;
            form.selectedOcrPageNumbers = document.pages.map((page) => page.pageNumber);
        });
        const document = createOcrDocument();
        mocks.createAiAction.mockReturnValue({ actionId: 'pdf-v2-action-0001' });
        mocks.extractTextFromPdf.mockResolvedValue(document);
        mocks.useTeacherAiQuota.mockReturnValue({
            aiUsageCount: 0,
            aiUsageRemaining: 100,
            hasAiQuota: true,
            dailyAiLimit: 100,
            refresh: vi.fn().mockResolvedValue(undefined),
        });
        mocks.requestServerQuizGeneration.mockResolvedValue({
            status: 'success',
            actionId: 'pdf-v2-action-0001',
            source: 'system',
            quiz: { title: 'Đề PDF', questions: [] },
        });

        const { result } = renderHook(() => useQuizGeneration({
            form: form as never,
            editingQuiz: null,
            isTeacherAccount: false,
            username: null,
            teacherName: 'Teacher',
            aiQuizV2Enabled: true,
            aiBlueprintV3Enabled: true,
            aiSvgDiagramsEnabled: false,
            serverQuizGenerationEnabled: true,
        }));

        await act(async () => {
            await result.current.handleGenerate('pdf');
        });
        form.selectedOcrPageNumbers = [1, 3];
        await act(async () => {
            await result.current.handleGenerate('pdf');
        });

        const request = mocks.requestServerQuizGeneration.mock.calls[0][0];
        expect(request.sourceMode).toBe('DOCUMENT_TEXT');
        expect(request.sourceRefs).toEqual(['page-1', 'page-3']);
        expect(request.content).toContain('=== TRANG 1 ===');
        expect(request.content).toContain('=== TRANG 3 ===');
        expect(request.content).not.toContain('=== TRANG 2 ===');
        expect(request.actionId).toBe('pdf-v2-action-0001');
    });

    it('keeps all legacy OCR pages and action reuse for a one-step server PDF flow', async () => {
        const form = createForm({
            quizMode: 'pdf',
            uploadedFile: new File(['pdf'], 'legacy.pdf', { type: 'application/pdf' }),
        });
        const document = createOcrDocument();
        mocks.createAiAction.mockReturnValue({ actionId: 'pdf-legacy-action-0001' });
        mocks.extractTextFromPdf.mockResolvedValue(document);
        mocks.useTeacherAiQuota.mockReturnValue({
            aiUsageCount: 0,
            aiUsageRemaining: 100,
            hasAiQuota: true,
            dailyAiLimit: 100,
            refresh: vi.fn().mockResolvedValue(undefined),
        });
        mocks.requestServerQuizGeneration.mockResolvedValue({
            status: 'success',
            actionId: 'pdf-legacy-action-0001',
            source: 'system',
            quiz: { title: 'Đề PDF cũ', questions: [] },
        });

        const { result } = renderHook(() => useQuizGeneration({
            form: form as never,
            editingQuiz: null,
            isTeacherAccount: false,
            username: null,
            teacherName: 'Teacher',
            aiQuizV2Enabled: false,
            aiBlueprintV3Enabled: true,
            aiSvgDiagramsEnabled: false,
            serverQuizGenerationEnabled: true,
        }));

        await act(async () => {
            await result.current.handleGenerate('pdf');
        });

        const request = mocks.requestServerQuizGeneration.mock.calls[0][0];
        expect(mocks.extractTextFromPdf).toHaveBeenCalledOnce();
        expect(request.sourceRefs).toEqual(['page-1', 'page-2', 'page-3']);
        expect(request.content).toContain('=== TRANG 1 ===');
        expect(request.content).toContain('=== TRANG 2 ===');
        expect(request.content).toContain('=== TRANG 3 ===');
        expect(request.actionId).toBe('pdf-legacy-action-0001');
    });
});
