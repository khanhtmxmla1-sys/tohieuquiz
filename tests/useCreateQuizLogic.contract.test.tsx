import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssignmentStore } from '../src/stores/useAssignmentStore';
import { useClassStore } from '../src/stores/useClassStore';
import { useAuthStore } from '../stores/authStore';

vi.mock('../src/services/geminiService', async () => {
    const actual = await vi.importActual<typeof import('../src/services/geminiService')>('../src/services/geminiService');
    return {
        ...actual,
        extractTextFromPdf: vi.fn(),
        generateQuiz: vi.fn(),
    };
});

vi.mock('../src/services/trangNguyenGeminiService', () => ({
    generateTrangNguyenQuiz: vi.fn(),
}));

vi.mock('../src/services/teacherAiQuotaService', () => ({
    getTeacherAiQuota: vi.fn(async () => ({ usedCount: 1, dailyLimit: 5 })),
    consumeTeacherAiQuota: vi.fn(async () => ({ usedCount: 2, dailyLimit: 5 })),
}));

vi.mock('../src/utils/toast', () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
}));

import { useCreateQuizLogic } from '../src/features/quiz-generator/hooks/useCreateQuizLogic';
import type { AiCredentialsController } from '../src/features/quiz-generator/hooks/useAiCredentials';

const createAiCredentials = (
    overrides: Partial<AiCredentialsController> = {},
): AiCredentialsController => ({
    enabled: true,
    capabilities: {
        text: true,
        documents: false,
        images: false,
        ocr: false,
        webSearch: false,
        imageGeneration: false,
    },
    summaries: {
        gemini: { provider: 'gemini', configured: false, last4: null, version: 0, verifiedAt: null, updatedAt: null },
        deepseek: { provider: 'deepseek', configured: false, last4: null, version: 0, verifiedAt: null, updatedAt: null },
    },
    defaultSource: 'system',
    loading: false,
    error: null,
    save: vi.fn(async () => undefined),
    test: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    setDefaultSource: vi.fn(async () => undefined),
    refetch: vi.fn(async () => undefined),
    ...overrides,
});

const expectedPublicKeys = [
    'accessCode',
    'acknowledgedQualityWarningIds',
    'canSaveQuiz',
    'questionQualitySummary',
    'saveQuizBlockReason',
    'toggleQualityWarningAcknowledgement',
    'addTagToState',
    'aiDetectedCategory',
    'aiDetectedLesson',
    'aiCredentials',
    'aiProvider',
    'aiSvgDiagramsEnabled',
    'aiSuggestedTags',
    'aiUsageCount',
    'aiUsageRemaining',
    'assignToClass',
    'autoGenerateSvg',
    'authStore',
    'category',
    'classLevel',
    'classStore',
    'content',
    'customPrompt',
    'dailyAiLimit',
    'deadline',
    'difficultyLevels',
    'error',
    'expandedSections',
    'fileInputRef',
    'generateRandomCode',
    'generatedQuiz',
    'generationStep',
    'handleApplyAiCategory',
    'handleApplyAiTitleSuggestion',
    'handleCopyLink',
    'handleGenerate',
    'handleGenerateTrial',
    'handleRegenerateSingle',
    'handleSaveQuiz',
    'handleSelectLearnerMode',
    'handleToggleThongTu27',
    'hasAiQuota',
    'isClassLocked',
    'isGenerating',
    'isSaving',
    'isTeacherAccount',
    'isTrialPreview',
    'linkCopied',
    'lockedClass',
    'manualTimeLimit',
    'maxAttempts',
    'profilePresetNotice',
    'promptProfile',
    'quizMode',
    'quizTitle',
    'requireCode',
    'savedQuizLink',
    'selectedClassId',
    'selectedTypes',
    'setAccessCode',
    'setAiProvider',
    'setAssignToClass',
    'setAutoGenerateSvg',
    'setCategory',
    'setClassLevel',
    'setContent',
    'setCustomPrompt',
    'setDeadline',
    'setDifficultyLevels',
    'setError',
    'setGeneratedQuiz',
    'setManualTimeLimit',
    'setMaxAttempts',
    'setQuizMode',
    'setQuizTitle',
    'setRequireCode',
    'setSelectedClassId',
    'setSelectedTypes',
    'setShowLinkModal',
    'setShowOnHome',
    'setTagInput',
    'setTags',
    'setTnSearchMode',
    'setTopic',
    'setUploadedFile',
    'showLinkModal',
    'showOnHome',
    'tagInput',
    'tags',
    'tnSearchMode',
    'toggleSection',
    'topic',
    'uploadedFile',
    'aiBlueprintV3Enabled',
    'aiQuizV2Enabled',
    'applyOcrDocument',
    'blueprintErrors',
    'cancelGeneration',
    'clearOcrDocument',
    'isBlueprintValid',
    'ocrDocument',
    'questionBlueprint',
    'questionBlueprintV3',
    'questionTypeAllocations',
    'quizIntent',
    'selectedOcrPageNumbers',
    'setQuestionBlueprint',
    'setQuestionTypeAllocations',
    'setQuizIntent',
    'setSelectedOcrPageNumbers',
].sort();

function resetStores() {
    useAuthStore.setState({
        isLoggedIn: true,
        username: 'teacher_test',
        teacherName: 'Teacher Test',
        isAdmin: false,
        teacherClass: '4A',
        token: 'test-token',
        isLoggingIn: false,
        loginError: false,
    });

    useClassStore.setState({
        classes: [],
        isLoading: false,
        error: null,
        fetchClasses: vi.fn(async () => undefined),
        addClass: vi.fn(async () => null),
        removeClass: vi.fn(async () => true),
        restoreClass: vi.fn(async () => true),
        clearError: vi.fn(),
    });

    useAssignmentStore.setState({
        assignments: [],
        isLoading: false,
        error: null,
        fetchAssignments: vi.fn(async () => undefined),
        fetchTeacherAssignments: vi.fn(async () => undefined),
        fetchAllAssignments: vi.fn(async () => undefined),
        fetchStudentAssignments: vi.fn(async () => undefined),
        addAssignment: vi.fn(async () => null),
        removeAssignment: vi.fn(async () => true),
        updateAssignmentDeadline: vi.fn(async () => true),
        updateAssignmentStatus: vi.fn(async () => true),
        startAssignmentAttempt: vi.fn(async () => true),
        resetAssignments: vi.fn(),
        clearError: vi.fn(),
    });
}

describe('useCreateQuizLogic public contract', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        resetStores();
    });

    it('keeps the return-object contract consumed by CreateTab', async () => {
        const { result } = renderHook(() => useCreateQuizLogic({
            editingQuiz: null,
            onSaveQuiz: vi.fn(async () => undefined),
            onUpdateQuiz: vi.fn(async () => undefined),
            onSuccess: vi.fn(),
            aiCredentials: createAiCredentials(),
        }));

        await waitFor(() => expect(result.current.dailyAiLimit).toBe(5));
        expect(Object.keys(result.current).sort()).toEqual(expectedPublicKeys);
    });

    it('keeps SVG generation off by default and updates explicit state only', async () => {
        const { result } = renderHook(() => useCreateQuizLogic({
            editingQuiz: null,
            onSaveQuiz: vi.fn(async () => undefined),
            onUpdateQuiz: vi.fn(async () => undefined),
            onSuccess: vi.fn(),
            aiCredentials: createAiCredentials(),
        }));

        expect(result.current.autoGenerateSvg).toBe(false);
        act(() => result.current.setAutoGenerateSvg(true));
        expect(result.current.autoGenerateSvg).toBe(true);
        await waitFor(() => expect(result.current.dailyAiLimit).toBe(5));
    });

    it('locks a teacher to the assigned class', () => {
        const { result } = renderHook(() => useCreateQuizLogic({
            editingQuiz: null,
            onSaveQuiz: vi.fn(async () => undefined),
            onUpdateQuiz: vi.fn(async () => undefined),
            onSuccess: vi.fn(),
            aiCredentials: createAiCredentials(),
        }));

        return waitFor(() => {
            expect(result.current.isClassLocked).toBe(true);
            expect(result.current.lockedClass).toBe('4A');
            expect(result.current.classLevel).toBe('4A');
            expect(result.current.dailyAiLimit).toBe(5);
        });
    });

    it('does not create an empty manual quiz inside the AI form state', async () => {
        const { result } = renderHook(() => useCreateQuizLogic({
            editingQuiz: null,
            onSaveQuiz: vi.fn(async () => undefined),
            onUpdateQuiz: vi.fn(async () => undefined),
            onSuccess: vi.fn(),
            aiCredentials: createAiCredentials(),
        }));

        expect(result.current.generatedQuiz).toBeNull();
        expect('handleStartManual' in result.current).toBe(false);
        await waitFor(() => expect(result.current.dailyAiLimit).toBe(5));
    });

    it('applies the server default once without persisting the provider in browser storage', async () => {
        localStorage.setItem('ai_provider', 'deepseek-personal');
        const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
        storageSpy.mockClear();
        const aiCredentials = createAiCredentials({
            defaultSource: 'gemini-personal',
            summaries: {
                gemini: { provider: 'gemini', configured: true, last4: '1234', version: 1, verifiedAt: null, updatedAt: null },
                deepseek: { provider: 'deepseek', configured: true, last4: '5678', version: 1, verifiedAt: null, updatedAt: null },
            },
        });

        const { result } = renderHook(() => useCreateQuizLogic({
            editingQuiz: null,
            onSaveQuiz: vi.fn(async () => undefined),
            onUpdateQuiz: vi.fn(async () => undefined),
            onSuccess: vi.fn(),
            aiCredentials,
        }));

        await waitFor(() => expect(result.current.aiProvider).toBe('gemini-personal'));
        expect(storageSpy).not.toHaveBeenCalledWith('ai_provider', expect.anything());

        act(() => result.current.setAiProvider('deepseek-personal'));
        expect(result.current.aiProvider).toBe('deepseek-personal');
        expect(aiCredentials.setDefaultSource).not.toHaveBeenCalled();
    });
});
