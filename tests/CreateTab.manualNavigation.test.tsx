import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuizStore } from '../stores/quizStore';

const logic = vi.hoisted(() => ({
    topic: '', setTopic: vi.fn(), quizTitle: 'Đề Toán lớp 4', setQuizTitle: vi.fn(),
    classLevel: '4A', setClassLevel: vi.fn(), category: 'toan', setCategory: vi.fn(),
    tags: ['phân số'], setTags: vi.fn(), tagInput: '', setTagInput: vi.fn(),
    aiDetectedCategory: null, aiDetectedLesson: '', aiSuggestedTags: [],
    content: '', setContent: vi.fn(), manualTimeLimit: 20, setManualTimeLimit: vi.fn(),
    isGenerating: false, generationStep: 'idle', generatedQuiz: null, setGeneratedQuiz: vi.fn(),
    error: null, setError: vi.fn(), isSaving: false, customPrompt: '', setCustomPrompt: vi.fn(),
    promptProfile: {}, profilePresetNotice: null, quizMode: 'practice', setQuizMode: vi.fn(),
    aiProvider: 'llm-mux', setAiProvider: vi.fn(), selectedTypes: {}, setSelectedTypes: vi.fn(),
    difficultyLevels: { level1: 1, level2: 0, level3: 0 }, setDifficultyLevels: vi.fn(),
    requireCode: true, setRequireCode: vi.fn(), accessCode: 'abc123', setAccessCode: vi.fn(),
    showOnHome: false, setShowOnHome: vi.fn(), uploadedFile: null, setUploadedFile: vi.fn(),
    fileInputRef: { current: null }, showLinkModal: false, setShowLinkModal: vi.fn(),
    savedQuizLink: '', linkCopied: false, expandedSections: {}, toggleSection: vi.fn(),
    assignToClass: false, setAssignToClass: vi.fn(), selectedClassId: '', setSelectedClassId: vi.fn(),
    deadline: '', setDeadline: vi.fn(), maxAttempts: 3, setMaxAttempts: vi.fn(),
    tnSearchMode: 'search', setTnSearchMode: vi.fn(), isClassLocked: false, lockedClass: '3',
    isTeacherAccount: false, aiUsageCount: 0, aiUsageRemaining: 5, hasAiQuota: true, dailyAiLimit: 5,
    generateRandomCode: vi.fn(), handleToggleThongTu27: vi.fn(), handleSelectLearnerMode: vi.fn(),
    addTagToState: vi.fn(), handleApplyAiCategory: vi.fn(), handleApplyAiTitleSuggestion: vi.fn(),
    handleGenerate: vi.fn(), handleRegenerateSingle: vi.fn(), handleSaveQuiz: vi.fn(), handleCopyLink: vi.fn(),
    classStore: { classes: [] }, authStore: { isAdmin: false },
}));

vi.mock('../src/features/quiz-generator/hooks/useCreateQuizLogic', () => ({
    useCreateQuizLogic: () => logic,
}));
vi.mock('../src/components/TeacherDashboard/QuizPreview', () => ({
    default: ({ onStartManual }: { onStartManual?: () => void }) => onStartManual ? (
        <button type="button" onClick={onStartManual}>Mở phòng soạn thủ công</button>
    ) : <div>Chỉ tạo đề bằng AI</div>,
}));
vi.mock('../src/components/common', () => ({
    Button: ({ children }: any) => <button type="button">{children}</button>,
}));
vi.mock('../src/features/quiz-generator/components/GeneralInfoSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/QuestionSettingsSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/PedagogicalProfileSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/ContentSourceSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/AdvancedSettingsSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/AssignmentSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/SuccessModal', () => ({ default: () => null }));

import CreateTab from '../src/components/TeacherDashboard/CreateTab';

const originalQuizState = useQuizStore.getState();

const RouteStateProbe = () => {
    const location = useLocation();
    return (
        <div>
            <span data-testid="pathname">{location.pathname}</span>
            <span data-testid="route-state">{JSON.stringify(location.state)}</span>
        </div>
    );
};

describe('CreateTab manual workspace navigation', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
        useQuizStore.setState({ ...originalQuizState, view: 'teacher_dash' }, true);
    });

    it('falls back to the legacy inline manual editor when the rollout flag is disabled', () => {
        vi.stubEnv('VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1', 'false');
        render(
            <MemoryRouter>
                <CreateTab
                    editingQuiz={null}
                    onSaveQuiz={vi.fn(async () => undefined)}
                    onUpdateQuiz={vi.fn(async () => undefined)}
                    onSuccess={vi.fn()}
                    aiCredentials={{} as never}
                    onOpenAiSettings={vi.fn()}
                />
                <RouteStateProbe />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'Tạo đề kiểm tra mới' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Mở phòng soạn thủ công' }));

        expect(screen.getByTestId('pathname')).toHaveTextContent('/');
        expect(logic.setGeneratedQuiz).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Đề Toán lớp 4',
            classLevel: '4A',
            questions: [],
            timeLimit: 20,
        }));
    });
});
