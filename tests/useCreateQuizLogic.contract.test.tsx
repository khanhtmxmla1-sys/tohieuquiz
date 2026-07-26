import { renderHook, waitFor } from '@testing-library/react';
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

const expectedPublicKeys = [
    'accessCode',
    'addTagToState',
    'aiDetectedCategory',
    'aiDetectedLesson',
    'aiProvider',
    'aiSuggestedTags',
    'aiUsageCount',
    'aiUsageRemaining',
    'assignToClass',
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
    'handleRegenerateSingle',
    'handleSaveQuiz',
    'handleSelectLearnerMode',
    'handleToggleThongTu27',
    'hasAiQuota',
    'isClassLocked',
    'isGenerating',
    'isSaving',
    'isTeacherAccount',
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
        }));

        await waitFor(() => expect(result.current.dailyAiLimit).toBe(5));
        expect(Object.keys(result.current).sort()).toEqual(expectedPublicKeys);
    });

    it('locks a teacher to the assigned class', () => {
        const { result } = renderHook(() => useCreateQuizLogic({
            editingQuiz: null,
            onSaveQuiz: vi.fn(async () => undefined),
            onUpdateQuiz: vi.fn(async () => undefined),
            onSuccess: vi.fn(),
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
        }));

        expect(result.current.generatedQuiz).toBeNull();
        expect('handleStartManual' in result.current).toBe(false);
        await waitFor(() => expect(result.current.dailyAiLimit).toBe(5));
    });
});
