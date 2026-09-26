import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../../../../stores/authStore';
import { useAssignmentStore } from '../../../stores/useAssignmentStore';
import {
    isAiBlueprintV3Enabled,
    isAiQuizV2Enabled,
    isAiSvgDiagramsEnabled,
} from '../../../config/featureFlags';
import { useClassStore } from '../../../stores/useClassStore';
import type { UseCreateQuizLogicProps } from '../domain/quizCreation.types';
import { useQuizFormState } from './useQuizFormState';
import { useQuizGeneration } from './useQuizGeneration';
import { useQuizPersistence } from './useQuizPersistence';
import { useQuizShareState } from './useQuizShareState';
import { useQuestionQualityReview } from './useQuestionQualityReview';
import type { AiCredentialsController } from './useAiCredentials';
import type { AIProvider } from '../../../services/geminiService';

const providerForDefaultSource = (
    source: AiCredentialsController['defaultSource'],
): AIProvider => {
    if (source === 'gemini-personal') return 'gemini-personal';
    if (source === 'deepseek-personal') return 'deepseek-personal';
    return 'llm-mux';
};

export const useCreateQuizLogic = ({
    editingQuiz,
    onSaveQuiz,
    onUpdateQuiz,
    onSuccess,
    aiCredentials,
}: UseCreateQuizLogicProps & { aiCredentials: AiCredentialsController }) => {
    const authStore = useAuthStore();
    const classStore = useClassStore();
    const assignmentStore = useAssignmentStore();
    const aiQuizV2Enabled = isAiQuizV2Enabled();
    const aiBlueprintV3Enabled = aiQuizV2Enabled && isAiBlueprintV3Enabled();
    const aiSvgDiagramsEnabled = aiQuizV2Enabled && isAiSvgDiagramsEnabled();

    const isTeacherAccount = !authStore.isAdmin;
    const isClassLocked = !authStore.isAdmin && !!authStore.teacherClass;
    const lockedClass = authStore.teacherClass || '3';

    const form = useQuizFormState({
        editingQuiz,
        isClassLocked,
        lockedClass,
        teacherName: authStore.teacherName,
    });
    const defaultAppliedForAccountRef = useRef<string | null>(null);
    const manuallySelectedForAccountRef = useRef<string | null>(null);
    const accountKey = authStore.username ?? null;
    const setAiProvider = useCallback((provider: AIProvider) => {
        manuallySelectedForAccountRef.current = accountKey;
        form.setAiProvider(provider);
    }, [accountKey, form.setAiProvider]);
    const share = useQuizShareState();
    const quality = useQuestionQualityReview({
        quiz: form.generatedQuiz,
        classLevel: form.classLevel,
    });
    const generation = useQuizGeneration({
        form,
        editingQuiz,
        isTeacherAccount,
        username: authStore.username,
        teacherName: authStore.teacherName,
        aiQuizV2Enabled,
        aiBlueprintV3Enabled,
        aiSvgDiagramsEnabled,
        aiCredentials,
    });
    const persistence = useQuizPersistence({
        form,
        share,
        editingQuiz,
        onSaveQuiz,
        onUpdateQuiz,
        onSuccess,
        addAssignment: assignmentStore.addAssignment,
        qualitySummary: quality.summary,
        acknowledgedWarningIds: quality.acknowledgedWarningIds,
        canSave: quality.canSave,
        saveBlockReason: quality.saveBlockReason,
    });

    useEffect(() => {
        if (authStore.username) {
            classStore.fetchClasses(authStore.username);
        }
    }, [authStore.username]);

    useEffect(() => {
        if (!accountKey || aiCredentials.loading) return;
        if (defaultAppliedForAccountRef.current === accountKey) return;
        if (manuallySelectedForAccountRef.current === accountKey) return;
        form.setAiProvider(providerForDefaultSource(aiCredentials.defaultSource));
        defaultAppliedForAccountRef.current = accountKey;
    }, [accountKey, aiCredentials.defaultSource, aiCredentials.loading, form.setAiProvider]);

    return {
        topic: form.topic,
        setTopic: form.setTopic,
        quizTitle: form.quizTitle,
        setQuizTitle: form.setQuizTitle,
        classLevel: form.classLevel,
        setClassLevel: form.setClassLevel,
        category: form.category,
        setCategory: form.setCategory,
        tags: form.tags,
        setTags: form.setTags,
        tagInput: form.tagInput,
        setTagInput: form.setTagInput,
        aiDetectedCategory: form.aiDetectedCategory,
        aiDetectedLesson: form.aiDetectedLesson,
        aiSuggestedTags: form.aiSuggestedTags,
        content: form.content,
        setContent: form.setContent,
        manualTimeLimit: form.manualTimeLimit,
        setManualTimeLimit: form.setManualTimeLimit,
        isGenerating: generation.isGenerating,
        generationStep: generation.generationStep,
        generatedQuiz: form.generatedQuiz,
        setGeneratedQuiz: form.setGeneratedQuiz,
        error: form.error,
        setError: form.setError,
        isSaving: persistence.isSaving,
        questionQualitySummary: quality.summary,
        acknowledgedQualityWarningIds: quality.acknowledgedWarningIds,
        isTrialPreview: quality.isTrialPreview,
        canSaveQuiz: quality.canSave,
        saveQuizBlockReason: quality.saveBlockReason,
        toggleQualityWarningAcknowledgement: quality.toggleWarningAcknowledgement,
        customPrompt: form.customPrompt,
        setCustomPrompt: form.setCustomPrompt,
        autoGenerateSvg: form.autoGenerateSvg,
        setAutoGenerateSvg: form.setAutoGenerateSvg,
        promptProfile: form.promptProfile,
        profilePresetNotice: form.profilePresetNotice,
        quizMode: form.quizMode,
        setQuizMode: form.setQuizMode,
        quizIntent: form.quizIntent,
        setQuizIntent: form.setQuizIntent,
        questionBlueprint: form.questionBlueprint,
        questionBlueprintV3: form.questionBlueprintV3,
        blueprintErrors: form.blueprintErrors,
        isBlueprintValid: form.isBlueprintValid,
        setQuestionBlueprint: form.setQuestionBlueprint,
        aiProvider: form.aiProvider,
        setAiProvider,
        aiCredentials,
        selectedTypes: form.selectedTypes,
        setSelectedTypes: form.setSelectedTypes,
        questionTypeAllocations: form.questionTypeAllocations,
        setQuestionTypeAllocations: form.setQuestionTypeAllocations,
        difficultyLevels: form.difficultyLevels,
        setDifficultyLevels: form.setDifficultyLevels,
        requireCode: form.requireCode,
        setRequireCode: form.setRequireCode,
        accessCode: form.accessCode,
        setAccessCode: form.setAccessCode,
        showOnHome: form.showOnHome,
        setShowOnHome: form.setShowOnHome,
        uploadedFile: form.uploadedFile,
        setUploadedFile: form.setUploadedFile,
        ocrDocument: form.ocrDocument,
        applyOcrDocument: form.applyOcrDocument,
        clearOcrDocument: form.clearOcrDocument,
        selectedOcrPageNumbers: form.selectedOcrPageNumbers,
        setSelectedOcrPageNumbers: form.setSelectedOcrPageNumbers,
        fileInputRef: form.fileInputRef,
        showLinkModal: share.showLinkModal,
        setShowLinkModal: share.setShowLinkModal,
        savedQuizLink: share.savedQuizLink,
        linkCopied: share.linkCopied,
        expandedSections: form.expandedSections,
        toggleSection: form.toggleSection,
        assignToClass: form.assignToClass,
        setAssignToClass: form.setAssignToClass,
        selectedClassId: form.selectedClassId,
        setSelectedClassId: form.setSelectedClassId,
        deadline: form.deadline,
        setDeadline: form.setDeadline,
        maxAttempts: form.maxAttempts,
        setMaxAttempts: form.setMaxAttempts,
        tnSearchMode: form.tnSearchMode,
        setTnSearchMode: form.setTnSearchMode,
        isClassLocked,
        lockedClass,
        isTeacherAccount,
        aiQuizV2Enabled,
        aiBlueprintV3Enabled,
        aiSvgDiagramsEnabled,
        aiUsageCount: generation.aiUsageCount,
        aiUsageRemaining: generation.aiUsageRemaining,
        hasAiQuota: generation.hasAiQuota,
        dailyAiLimit: generation.dailyAiLimit,
        generateRandomCode: form.generateRandomCode,
        handleToggleThongTu27: form.handleToggleThongTu27,
        handleSelectLearnerMode: form.handleSelectLearnerMode,
        addTagToState: form.addTagToState,
        handleApplyAiCategory: form.handleApplyAiCategory,
        handleApplyAiTitleSuggestion: form.handleApplyAiTitleSuggestion,
        handleGenerate: generation.handleGenerate,
        handleGenerateTrial: generation.handleGenerateTrial,
        handleRegenerateSingle: generation.handleRegenerateSingle,
        cancelGeneration: generation.cancelGeneration,
        handleSaveQuiz: persistence.handleSaveQuiz,
        handleCopyLink: share.handleCopyLink,
        classStore,
        authStore,
    };
};
