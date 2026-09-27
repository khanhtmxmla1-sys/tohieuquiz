import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import { useQuizGeneration } from '../src/features/quiz-generator/hooks/useQuizGeneration';

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

const createForm = () => ({
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
    ocrDocument: null,
    selectedOcrPageNumbers: [],
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
});
