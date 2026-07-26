import { useRef, useState } from 'react';
import type { Quiz, Question } from '../../../types';
import { QuestionType } from '../../../types';
import {
    extractTextFromPdf,
    generateQuiz,
    type AIProvider,
} from '../../../services/geminiService';
import {
    buildSelectedOcrText,
    type OcrDocument,
} from '../../../services/ai/schemas/ocrDocumentSchema';
import { generateTrangNguyenQuiz } from '../../../services/trangNguyenGeminiService';
import { showError } from '../../../utils/toast';
import { getQuizGenerationUserMessage } from '../../../services/ai/quizGenerationErrors';
import { normalizeAiCategory, normalizeTags } from '../utils/quizNormalizers';
import { buildQuizGenerationOptions } from '../domain/buildQuizGenerationRequest';
import { buildQuestionRegenerationPrompt } from '../../../services/ai/prompts/questionRegenerationPrompt';
import { isAiSelectableQuestionType } from '../../../services/ai/question-contracts/questionTypeAvailability';
import type { GeneratedQuestionV3 } from '../../../services/ai/question-contracts/questionContract.types';
import { validateQuizGenerationInput } from '../domain/quizCreationValidation';
import type { GenerationStep, QuizMode } from '../domain/quizCreation.types';
import type { useQuizFormState } from './useQuizFormState';
import { createAiAction, type ClientAiAction } from '../../../services/ai/aiAction';
import { useTeacherAiQuota } from './useTeacherAiQuota';

interface UseQuizGenerationOptions {
    form: ReturnType<typeof useQuizFormState>;
    editingQuiz: Quiz | null;
    isTeacherAccount: boolean;
    username: string | null;
    teacherName: string | null;
    aiQuizV2Enabled: boolean;
    aiBlueprintV3Enabled: boolean;
}

interface ActiveGeneration {
    action: ClientAiAction;
    controller: AbortController;
    phase: 'ocr' | 'generate';
    sourceFileKey?: string;
}

const fileKey = (file: File): string => `${file.name}:${file.size}:${file.lastModified}`;

export const useQuizGeneration = ({
    form,
    editingQuiz,
    isTeacherAccount,
    username,
    teacherName,
    aiQuizV2Enabled,
    aiBlueprintV3Enabled,
}: UseQuizGenerationOptions) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStep, setGenerationStep] = useState<GenerationStep>('idle');
    const activeGenerationRef = useRef<ActiveGeneration | null>(null);
    const quota = useTeacherAiQuota({ isTeacherAccount, username });

    const createQuizFromResult = (
        result: Record<string, unknown>,
        optionsTitle: string,
        detectedCategory: string | null,
        detectedLesson: string,
        suggestedTags: string[],
    ): Quiz => ({
        id: editingQuiz?.id || `quiz-${Date.now()}`,
        title: (result.title as string) || optionsTitle,
        classLevel: form.classLevel,
        timeLimit: typeof form.manualTimeLimit === 'number'
            ? form.manualTimeLimit
            : (result.timeLimit as number) || 15,
        questions: ((result.questions || []) as Question[]).map(
            (question: Question, index: number) => ({
                ...question,
                id: question.id || `q-${Date.now()}-${index}`,
            }),
        ),
        createdAt: editingQuiz ? editingQuiz.createdAt : new Date().toISOString(),
        createdBy: editingQuiz?.createdBy || teacherName || undefined,
        accessCode: form.requireCode ? form.accessCode.toUpperCase() : undefined,
        requireCode: form.requireCode,
        showOnHome: form.showOnHome,
        category: form.category,
        tags: form.tags,
        detectedCategory: detectedCategory || undefined,
        detectedLesson: detectedLesson || undefined,
        suggestedTags: suggestedTags.length > 0 ? suggestedTags : undefined,
    });

    const prepareOcrPreview = async (file: File): Promise<OcrDocument | null> => {
        activeGenerationRef.current?.controller.abort();
        const action = createAiAction('QUIZ_CREATE');
        const controller = new AbortController();
        const sourceFileKey = fileKey(file);
        activeGenerationRef.current = { action, controller, phase: 'ocr', sourceFileKey };
        form.clearOcrDocument();
        setIsGenerating(true);
        setGenerationStep('reading_document');

        try {
            const ocrProvider: AIProvider = [
                'gemini',
                'llm-mux',
                'native-ocr',
            ].includes(form.aiProvider)
                ? form.aiProvider
                : 'llm-mux';
            const document = await extractTextFromPdf(file, ocrProvider, {
                action,
                stage: 'OCR',
                signal: controller.signal,
            });
            form.applyOcrDocument(document);
            activeGenerationRef.current = {
                action,
                controller,
                phase: 'generate',
                sourceFileKey,
            };
            setGenerationStep('idle');
            return document;
        } catch (error: unknown) {
            activeGenerationRef.current = null;
            if (controller.signal.aborted) {
                setGenerationStep('cancelled');
            } else {
                const normalizedError = error instanceof Error ? error : new Error(String(error));
                showError(normalizedError.message || 'Không thể đọc tài liệu.');
                setGenerationStep('idle');
            }
            return null;
        } finally {
            setIsGenerating(false);
            void quota.refresh();
        }
    };

    const handleGenerate = async (modeOverride?: QuizMode) => {
        const activeQuizMode = modeOverride ?? form.quizMode;
        const isPdfMode = activeQuizMode === 'pdf';
        form.setQuizMode(activeQuizMode);
        if (activeQuizMode === 'exam') form.setQuizIntent('EXAM');
        if (activeQuizMode === 'practice') form.setQuizIntent('PRACTICE');

        const validation = validateQuizGenerationInput({
            mode: activeQuizMode,
            uploadedFile: form.uploadedFile,
            topic: form.topic,
            classLevel: form.classLevel,
            selectedTypes: form.selectedTypes,
            typeAllocations: form.questionTypeAllocations,
            intent: activeQuizMode === 'exam'
                ? 'EXAM'
                : activeQuizMode === 'practice'
                    ? 'PRACTICE'
                    : form.quizIntent,
            difficultyLevels: form.difficultyLevels,
        });
        if (validation.error) {
            showError(validation.error);
            return;
        }

        let legacyOcrDocument: OcrDocument | null = null;
        if (isPdfMode && form.uploadedFile) {
            if (aiQuizV2Enabled) {
                const pending = activeGenerationRef.current;
                const hasMatchingPreview = form.ocrDocument
                    && pending?.phase === 'generate'
                    && pending.sourceFileKey === fileKey(form.uploadedFile);
                if (!hasMatchingPreview) {
                    await prepareOcrPreview(form.uploadedFile);
                    return;
                }
                if (form.selectedOcrPageNumbers.length === 0) {
                    showError('Cần chọn ít nhất một trang.');
                    return;
                }
            } else {
                legacyOcrDocument = await prepareOcrPreview(form.uploadedFile);
                if (!legacyOcrDocument) return;
            }
        }

        const pendingAction = activeGenerationRef.current?.phase === 'generate'
            ? activeGenerationRef.current
            : null;
        const action = pendingAction?.action ?? createAiAction('QUIZ_CREATE');
        const controller = pendingAction?.controller ?? new AbortController();
        activeGenerationRef.current = {
            action,
            controller,
            phase: 'generate',
            sourceFileKey: pendingAction?.sourceFileKey,
        };

        setIsGenerating(true);
        setGenerationStep('generating');
        form.setAiDetectedCategory(null);
        form.setAiDetectedLesson('');
        form.setAiSuggestedTags([]);

        try {
            if (form.category === 'trang-nguyen') {
                const trangNguyenTypes: string[] = [];
                if (form.selectedTypes[QuestionType.MCQ]) trangNguyenTypes.push('single_choice');
                if (form.selectedTypes[QuestionType.MULTIPLE_SELECT]) trangNguyenTypes.push('multiple_select');
                if (form.selectedTypes[QuestionType.SHORT_ANSWER]) trangNguyenTypes.push('fill_blank');
                if (form.selectedTypes[QuestionType.MATCHING]) trangNguyenTypes.push('matching');
                if (form.selectedTypes[QuestionType.CATEGORIZATION]) trangNguyenTypes.push('grouping');
                if (form.selectedTypes[QuestionType.ORDERING]) trangNguyenTypes.push('rearrange');
                if (form.selectedTypes[QuestionType.TRUE_FALSE]) trangNguyenTypes.push('reading');

                const result = await generateTrangNguyenQuiz({
                    topic: form.topic,
                    classLevel: form.classLevel,
                    questionTypes: trangNguyenTypes.length > 0
                        ? trangNguyenTypes
                        : ['single_choice', 'fill_blank'],
                    questionCount: validation.questionCount,
                    difficulty: 'mixed',
                    customPrompt: form.customPrompt.trim() || undefined,
                    enableSearch: form.tnSearchMode === 'search',
                });

                form.setGeneratedQuiz({
                    id: editingQuiz?.id || `tn-quiz-${Date.now()}`,
                    title: form.quizTitle || result.title,
                    classLevel: form.classLevel,
                    timeLimit: typeof form.manualTimeLimit === 'number'
                        ? form.manualTimeLimit
                        : result.timeLimit,
                    questions: result.questions,
                    createdAt: editingQuiz ? editingQuiz.createdAt : new Date().toISOString(),
                    createdBy: editingQuiz?.createdBy || teacherName || undefined,
                    accessCode: form.requireCode ? form.accessCode.toUpperCase() : undefined,
                    requireCode: form.requireCode,
                    category: 'trang-nguyen',
                    showOnHome: form.showOnHome,
                    tags: form.tags,
                } as Quiz);
                setGenerationStep('completed');
                return;
            }

            const titlePrefix = isPdfMode
                ? 'Đề từ tài liệu'
                : activeQuizMode === 'exam'
                    ? 'Kiểm tra'
                    : 'Ôn tập';
            let generationContent = form.content;
            let generationFile: File | undefined = form.uploadedFile || undefined;
            let generationTopic = form.topic;

            const sourceOcrDocument = legacyOcrDocument ?? form.ocrDocument;
            if (isPdfMode && form.uploadedFile && sourceOcrDocument) {
                const selectedPageNumbers = legacyOcrDocument
                    ? legacyOcrDocument.pages.map((page) => page.pageNumber)
                    : form.selectedOcrPageNumbers;
                const selectedOcrText = buildSelectedOcrText(
                    sourceOcrDocument,
                    selectedPageNumbers,
                );
                if (selectedOcrText.trim().length < 120) {
                    throw new Error(
                        'Các trang đã chọn chưa có đủ nội dung. Vui lòng chọn thêm trang hoặc dùng file rõ hơn.',
                    );
                }
                generationContent = [form.content.trim(), selectedOcrText]
                    .filter(Boolean)
                    .join('\n\n');
                generationTopic = form.topic || form.uploadedFile.name.replace(/\.[^/.]+$/, '');
                generationFile = undefined;
            }

            const options = buildQuizGenerationOptions({
                title: form.quizTitle || `${titlePrefix}: ${
                    form.topic
                    || form.uploadedFile?.name?.replace(/\.[^/.]+$/, '')
                    || 'Bài kiểm tra'
                }`,
                topic: generationTopic,
                classLevel: form.classLevel,
                questionCount: validation.questionCount,
                questionTypes: validation.enabledTypes,
                typeAllocations: form.questionTypeAllocations,
                difficultyLevels: form.difficultyLevels,
                promptProfile: form.promptProfile,
                imageLibrary: form.imageLibrary,
                customPrompt: form.customPrompt,
                quizMode: activeQuizMode,
                intent: activeQuizMode === 'exam'
                    ? 'EXAM'
                    : activeQuizMode === 'practice'
                        ? 'PRACTICE'
                        : form.quizIntent,
                sourceMode: isPdfMode ? 'DOCUMENT' : 'TOPIC',
                sourceRefs: isPdfMode
                    ? form.selectedOcrPageNumbers.map((pageNumber) => `page-${pageNumber}`)
                    : undefined,
                isPdfMode,
            }, { enableBlueprintV3: aiBlueprintV3Enabled });

            const result = await generateQuiz(
                generationTopic,
                form.classLevel,
                generationContent,
                generationFile,
                options,
                undefined,
                form.aiProvider,
                setGenerationStep,
                {
                    action,
                    stage: 'GENERATE',
                    signal: controller.signal,
                },
            ) as Record<string, unknown>;

            const detectedCategory = normalizeAiCategory(result.detectedCategory);
            const detectedLesson = typeof result.detectedLesson === 'string'
                ? result.detectedLesson.trim()
                : '';
            const suggestedTags = normalizeTags(result.suggestedTags);

            form.setAiDetectedCategory(detectedCategory);
            form.setAiDetectedLesson(detectedLesson);
            form.setAiSuggestedTags(suggestedTags);
            form.setGeneratedQuiz(createQuizFromResult(
                result,
                options.title,
                detectedCategory,
                detectedLesson,
                suggestedTags,
            ));
            setGenerationStep('completed');
        } catch (error: unknown) {
            if (controller.signal.aborted) {
                setGenerationStep('cancelled');
            } else {
                showError(getQuizGenerationUserMessage(error));
                setGenerationStep('idle');
            }
        } finally {
            if (activeGenerationRef.current?.action.actionId === action.actionId) {
                activeGenerationRef.current = null;
            }
            setIsGenerating(false);
            void quota.refresh();
        }
    };

    const handleRegenerateSingle = async (question: Question): Promise<Question | null> => {
        const action = createAiAction('QUESTION_REGENERATE');
        const controller = new AbortController();
        try {
            const topic = form.topic || form.generatedQuiz?.title || 'T?ng h?p';
            const useV3Regeneration = aiBlueprintV3Enabled && isAiSelectableQuestionType(question.type);
            const supportedSubject = question.subject === 'math' || question.subject === 'vietnamese'
                ? question.subject
                : undefined;
            const regenerationOptions = buildQuizGenerationOptions({
                title: form.quizTitle || `Sinh l?i c?u h?i: ${form.topic || 'B?i ki?m tra'}`,
                topic,
                classLevel: form.classLevel,
                questionCount: 1,
                questionTypes: [question.type],
                typeAllocations: [{ type: question.type, count: 1 }],
                difficultyLevels: {
                    level1: question.difficulty === 1 ? 1 : 0,
                    level2: question.difficulty === 2 || !question.difficulty ? 1 : 0,
                    level3: question.difficulty === 3 ? 1 : 0,
                },
                promptProfile: form.promptProfile,
                imageLibrary: form.imageLibrary,
                customPrompt: `T?o n?i dung m?i d?a tr?n c?u hi?n t?i: ${JSON.stringify(question)}`,
                quizMode: form.quizMode,
                intent: form.quizIntent,
                sourceMode: form.quizMode === 'pdf' ? 'DOCUMENT' : 'TOPIC',
                subject: supportedSubject,
                skillCode: question.skillCode,
                subskillCode: question.subskillCode,
                isPdfMode: false,
            }, { enableBlueprintV3: useV3Regeneration });

            if (useV3Regeneration && regenerationOptions.blueprintV3) {
                const slot = regenerationOptions.blueprintV3.slots[0];
                const summarize = (candidate: Question): string => {
                    const record = candidate as unknown as Record<string, unknown>;
                    return String(
                        record.question
                        ?? record.mainQuestion
                        ?? record.sentence
                        ?? record.text
                        ?? candidate.type,
                    ).slice(0, 220);
                };
                regenerationOptions.customPrompt = buildQuestionRegenerationPrompt({
                    slot,
                    currentQuestion: {
                        ...(question as unknown as Record<string, unknown>),
                        slotId: slot.slotId,
                        type: slot.type,
                        difficulty: slot.difficulty,
                        explanation: question.explanation || 'C?u hi?n t?i ch?a c? l?i gi?i.',
                    } as GeneratedQuestionV3,
                    otherQuestionSummaries: (form.generatedQuiz?.questions ?? [])
                        .filter((candidate) => candidate.id !== question.id)
                        .map((candidate) => ({
                            slotId: candidate.id,
                            normalizedPrompt: summarize(candidate),
                        })),
                    teacherInstruction: 'T?o m?t c?u m?i kh?c n?i dung, gi? nguy?n k? n?ng v? c?u tr?c t??ng t?c.',
                });
            }

            const result = await generateQuiz(
                topic,
                form.classLevel,
                form.content,
                undefined,
                regenerationOptions,
                undefined,
                form.aiProvider,
                undefined,
                {
                    action,
                    stage: 'REGENERATE',
                    signal: controller.signal,
                },
            ) as Record<string, unknown>;
            const questions = Array.isArray(result.questions) ? result.questions : [];
            return questions.length > 0
                ? { ...(questions[0] as Question), id: question.id }
                : null;
        } catch (error) {
            console.error('Lỗi khi sinh lại câu hỏi:', error);
            throw error;
        }
    };

    return {
        isGenerating,
        generationStep,
        aiUsageCount: quota.aiUsageCount,
        aiUsageRemaining: quota.aiUsageRemaining,
        hasAiQuota: quota.hasAiQuota,
        dailyAiLimit: quota.dailyAiLimit,
        handleGenerate,
        handleRegenerateSingle,
        cancelGeneration: () => {
            const activeGeneration = activeGenerationRef.current;
            if (!activeGeneration) return;
            setGenerationStep('cancelled');
            activeGeneration.controller.abort();
        },
    };
};
