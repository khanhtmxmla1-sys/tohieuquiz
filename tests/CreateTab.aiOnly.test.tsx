import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('../src/components/TeacherDashboard/QuizPreview', async () => {
    const { default: EmptyQuizPreview } = await import('../src/components/TeacherDashboard/quiz-preview/EmptyQuizPreview');
    return {
        default: ({ onStartManual }: { onStartManual?: () => void }) => (
            <EmptyQuizPreview onStartManual={onStartManual} />
        ),
    };
});
vi.mock('../src/components/common', () => ({
    Button: ({ children }: any) => <button type="button">{children}</button>,
}));
vi.mock('../src/features/quiz-generator/components/GeneralInfoSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/QuestionSettingsSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/PedagogicalProfileSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/ContentSourceSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/OcrPreviewSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/AdvancedSettingsSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/AssignmentSection', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/GenerationProgressPanel', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/SuccessModal', () => ({ default: () => null }));
vi.mock('../src/features/quiz-generator/components/GenerationReadinessSummary', () => ({ default: () => null }));

import CreateTab from '../src/components/TeacherDashboard/CreateTab';

describe('CreateTab AI-only entry', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it('labels the page as AI creation and removes the manual workspace entry', () => {
        render(
            <MemoryRouter>
                <CreateTab
                    editingQuiz={null}
                    onSaveQuiz={vi.fn(async () => undefined)}
                    onUpdateQuiz={vi.fn(async () => undefined)}
                    onSuccess={vi.fn()}
                />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'Tạo đề bằng AI' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Mở phòng soạn/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Hoàn thành cấu hình bên trái/i)).toBeInTheDocument();
    });
});
