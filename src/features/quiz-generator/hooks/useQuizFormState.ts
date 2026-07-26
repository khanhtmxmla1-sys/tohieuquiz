import { useEffect, useMemo, useRef, useState } from 'react';
import { QuestionType, type ImageLibraryItem, type Quiz } from '../../../types';
import type {
    AIProvider,
    LearnerPromptMode,
    PromptProfileOptions,
} from '../../../services/geminiService';
import { normalizeAiCategory, normalizeTagValue, normalizeTags } from '../utils/quizNormalizers';
import {
    createDefaultDeadline,
    createDefaultDifficultyLevels,
    createDefaultExpandedSections,
    createDefaultSelectedTypes,
    createPromptProfile,
    createRandomAccessCode,
    DEFAULT_PROMPT_PROFILE,
    getPromptProfileNotice,
    parseQuizTags,
    resolvePromptProfilePreset,
} from '../domain/quizCreationDefaults';
import type {
    DifficultyLevels,
    ExpandedSections,
    QuizMode,
    TrangNguyenSearchMode,
} from '../domain/quizCreation.types';
import {
    buildBalancedTypeAllocations,
    buildQuestionBlueprintSlots,
    validateQuizBlueprint,
    type QuestionTypeAllocation,
    type QuizBlueprint,
    type QuizBlueprintV3,
    type QuizIntent,
} from '../domain/quizBlueprint';
import type { OcrDocument } from '../../../services/ai/schemas/ocrDocumentSchema';
import { useGeneratedQuizSync } from './useGeneratedQuizSync';

interface UseQuizFormStateOptions {
    editingQuiz: Quiz | null;
    isClassLocked: boolean;
    lockedClass: string;
    teacherName: string | null;
}

const enabledTypesFromSelection = (selectedTypes: Record<string, boolean>): QuestionType[] => (
    Object.entries(selectedTypes)
        .filter(([, enabled]) => enabled)
        .map(([type]) => type as QuestionType)
);

const createDefaultTypeAllocations = (): QuestionTypeAllocation[] => (
    buildBalancedTypeAllocations(enabledTypesFromSelection(createDefaultSelectedTypes()), 10)
);

export const useQuizFormState = ({
    editingQuiz,
    isClassLocked,
    lockedClass,
    teacherName,
}: UseQuizFormStateOptions) => {
    const [topic, setTopic] = useState('');
    const [quizTitle, setQuizTitle] = useState('');
    const [classLevel, setClassLevel] = useState(isClassLocked ? lockedClass : '3');
    const [category, setCategory] = useState('toan');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [aiDetectedCategory, setAiDetectedCategory] = useState<string | null>(null);
    const [aiDetectedLesson, setAiDetectedLesson] = useState('');
    const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
    const [content, setContent] = useState('');
    const [manualTimeLimit, setManualTimeLimit] = useState<number | ''>('');
    const [generatedQuiz, setGeneratedQuiz] = useState<Quiz | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [quizMode, setQuizMode] = useState<QuizMode>('practice');
    const [quizIntent, setQuizIntent] = useState<QuizIntent>('PRACTICE');
    const [aiProvider, setAiProvider] = useState<AIProvider>(() =>
        (localStorage.getItem('ai_provider') as AIProvider) || 'llm-mux'
    );
    const [selectedTypes, setSelectedTypesState] = useState<Record<string, boolean>>(
        createDefaultSelectedTypes,
    );
    const [questionTypeAllocations, setQuestionTypeAllocations] = useState<QuestionTypeAllocation[]>(
        createDefaultTypeAllocations,
    );
    const [difficultyLevels, setDifficultyLevels] = useState<DifficultyLevels>(
        createDefaultDifficultyLevels,
    );
    const [promptProfile, setPromptProfile] = useState<PromptProfileOptions>(DEFAULT_PROMPT_PROFILE);
    const [profilePresetNotice, setProfilePresetNotice] = useState<string | null>(null);
    const [requireCode, setRequireCode] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [showOnHome, setShowOnHome] = useState(true);
    const [uploadedFile, setUploadedFileState] = useState<File | null>(null);
    const [ocrDocument, setOcrDocumentState] = useState<OcrDocument | null>(null);
    const [selectedOcrPageNumbers, setSelectedOcrPageNumbers] = useState<number[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedSections, setExpandedSections] = useState<ExpandedSections>(
        createDefaultExpandedSections,
    );
    const [imageLibrary, setImageLibrary] = useState<ImageLibraryItem[]>(() => {
        const saved = localStorage.getItem('quiz_image_library');
        return saved ? JSON.parse(saved) : [];
    });
    const [assignToClass, setAssignToClass] = useState(false);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [deadline, setDeadline] = useState(createDefaultDeadline);
    const [maxAttempts, setMaxAttempts] = useState(3);
    const [tnSearchMode, setTnSearchMode] = useState<TrangNguyenSearchMode>('search');

    const questionCount = difficultyLevels.level1 + difficultyLevels.level2 + difficultyLevels.level3;
    const questionBlueprint = useMemo<QuizBlueprint>(() => ({
        intent: quizIntent,
        sourceMode: quizMode === 'pdf' ? 'DOCUMENT' : 'TOPIC',
        totalQuestions: questionCount,
        typeAllocations: questionTypeAllocations.map((allocation) => ({ ...allocation })),
        difficultyLevels: { ...difficultyLevels },
    }), [difficultyLevels, questionCount, questionTypeAllocations, quizIntent, quizMode]);
    const blueprintErrors = useMemo(
        () => validateQuizBlueprint(questionBlueprint),
        [questionBlueprint],
    );
    const questionBlueprintV3 = useMemo<QuizBlueprintV3 | null>(() => {
        if (blueprintErrors.length > 0 || !classLevel.trim()) return null;
        const objective = topic.trim() || quizTitle.trim() || 'Bài kiểm tra';
        try {
            return {
                version: 3,
                intent: questionBlueprint.intent,
                sourceMode: questionBlueprint.sourceMode,
                topic: objective,
                classLevel: classLevel.trim(),
                totalQuestions: questionBlueprint.totalQuestions,
                slots: buildQuestionBlueprintSlots({
                    totalQuestions: questionBlueprint.totalQuestions,
                    typeAllocations: questionBlueprint.typeAllocations,
                    difficultyLevels: questionBlueprint.difficultyLevels,
                    objective,
                    sourceRefs: questionBlueprint.sourceMode === 'DOCUMENT'
                        ? selectedOcrPageNumbers.map((pageNumber) => `page-${pageNumber}`)
                        : undefined,
                }),
            };
        } catch {
            return null;
        }
    }, [
        blueprintErrors,
        classLevel,
        questionBlueprint,
        quizTitle,
        selectedOcrPageNumbers,
        topic,
    ]);

    const setUploadedFile = (nextFile: File | null) => {
        setUploadedFileState(nextFile);
        setOcrDocumentState(null);
        setSelectedOcrPageNumbers([]);
    };

    const applyOcrDocument = (nextDocument: OcrDocument) => {
        setOcrDocumentState(nextDocument);
        setSelectedOcrPageNumbers(nextDocument.pages.map((page) => page.pageNumber));
    };

    const clearOcrDocument = () => {
        setOcrDocumentState(null);
        setSelectedOcrPageNumbers([]);
    };

    const setSelectedTypes = (nextTypes: Record<string, boolean>) => {
        setSelectedTypesState(nextTypes);
        setQuestionTypeAllocations(buildBalancedTypeAllocations(
            enabledTypesFromSelection(nextTypes),
            questionCount,
        ));
    };

    const setQuestionBlueprint = (nextBlueprint: QuizBlueprint) => {
        setQuizIntent(nextBlueprint.intent);
        setQuestionTypeAllocations(nextBlueprint.typeAllocations.map((allocation) => ({ ...allocation })));
        setDifficultyLevels({ ...nextBlueprint.difficultyLevels });
    };

    const toggleSection = (section: string) => {
        setExpandedSections((previous) => ({
            ...previous,
            [section]: !previous[section],
        }));
    };

    const applyPromptProfilePreset = (nextProfile: PromptProfileOptions) => {
        setPromptProfile(nextProfile);
        if (!nextProfile.useThongTu27) {
            setProfilePresetNotice(null);
            return;
        }

        const totalQuestions = difficultyLevels.level1
            + difficultyLevels.level2
            + difficultyLevels.level3;
        const { levels, presetLabel } = resolvePromptProfilePreset(totalQuestions, nextProfile);
        setDifficultyLevels(levels);
        setProfilePresetNotice(getPromptProfileNotice(presetLabel));
    };

    const handleToggleThongTu27 = () => {
        if (promptProfile.useThongTu27) {
            setPromptProfile(DEFAULT_PROMPT_PROFILE);
            setProfilePresetNotice(null);
            return;
        }
        applyPromptProfilePreset(createPromptProfile('default'));
    };

    const handleSelectLearnerMode = (learnerMode: LearnerPromptMode) => {
        if (!promptProfile.useThongTu27) return;
        applyPromptProfilePreset(createPromptProfile(learnerMode));
    };

    const generateRandomCode = () => {
        const code = createRandomAccessCode();
        setAccessCode(code);
        return code;
    };

    const addTagToState = (rawValue: string) => {
        const normalizedTag = normalizeTagValue(rawValue);
        if (!normalizedTag) return;
        setTags((previous) => {
            const normalizedExisting = new Set(
                previous.map((tag) => normalizeTagValue(tag)),
            );
            return normalizedExisting.has(normalizedTag)
                ? previous
                : [...previous, normalizedTag];
        });
    };

    const handleApplyAiCategory = () => {
        if (aiDetectedCategory) setCategory(aiDetectedCategory);
    };

    const handleApplyAiTitleSuggestion = () => {
        if (aiDetectedLesson) setQuizTitle(aiDetectedLesson);
    };

    const resetAfterSave = () => {
        setTopic('');
        setQuizTitle('');
        setContent('');
        setCustomPrompt('');
        setRequireCode(false);
        setAccessCode('');
        setShowOnHome(true);
        setUploadedFile(null);
        setGeneratedQuiz(null);
        setTags([]);
        setTagInput('');
        setAiDetectedCategory(null);
        setAiDetectedLesson('');
        setAiSuggestedTags([]);
        setPromptProfile(DEFAULT_PROMPT_PROFILE);
        setProfilePresetNotice(null);
        setQuizMode('practice');
        setQuizIntent('PRACTICE');
    };

    useEffect(() => {
        if (editingQuiz) {
            setTopic('');
            setQuizTitle(editingQuiz.title);
            setClassLevel(editingQuiz.classLevel);
            setContent('');
            setManualTimeLimit(editingQuiz.timeLimit);
            setGeneratedQuiz(editingQuiz);
            setRequireCode(!!editingQuiz.requireCode);
            setAccessCode(editingQuiz.accessCode || '');
            setShowOnHome(editingQuiz.showOnHome !== false);
            setCategory(editingQuiz.category || 'toan');
            setTags(parseQuizTags(editingQuiz.tags));
            setTagInput('');
            setAiDetectedCategory(normalizeAiCategory(editingQuiz.detectedCategory));
            setAiDetectedLesson(
                typeof editingQuiz.detectedLesson === 'string' ? editingQuiz.detectedLesson : '',
            );
            setAiSuggestedTags(normalizeTags(editingQuiz.suggestedTags));
            setPromptProfile(DEFAULT_PROMPT_PROFILE);
            setProfilePresetNotice(null);
            setQuizIntent(editingQuiz.isPractice ? 'PRACTICE' : 'EXAM');
            setQuizMode(editingQuiz.isPractice ? 'practice' : 'exam');
            return;
        }

        setTopic('');
        setQuizTitle('');
        setClassLevel(isClassLocked ? lockedClass : '3');
        setContent('');
        setManualTimeLimit('');
        setGeneratedQuiz(null);
        setRequireCode(false);
        setAccessCode('');
        setShowOnHome(true);
        setCustomPrompt('');
        setUploadedFile(null);
        setCategory('toan');
        setTags([]);
        setTagInput('');
        setAiDetectedCategory(null);
        setAiDetectedLesson('');
        setAiSuggestedTags([]);
        setPromptProfile(DEFAULT_PROMPT_PROFILE);
        setProfilePresetNotice(null);
        setQuizMode('practice');
        setQuizIntent('PRACTICE');
    }, [editingQuiz, isClassLocked, lockedClass]);

    useEffect(() => {
        localStorage.setItem('quiz_image_library', JSON.stringify(imageLibrary));
    }, [imageLibrary]);

    useEffect(() => {
        localStorage.setItem('ai_provider', aiProvider);
    }, [aiProvider]);

    useGeneratedQuizSync({
        generatedQuiz,
        setGeneratedQuiz,
        manualTimeLimit,
        classLevel,
        category,
        requireCode,
        accessCode,
        showOnHome,
        quizTitle,
        teacherName,
        tags,
    });

    return {
        topic,
        setTopic,
        quizTitle,
        setQuizTitle,
        classLevel,
        setClassLevel,
        category,
        setCategory,
        tags,
        setTags,
        tagInput,
        setTagInput,
        aiDetectedCategory,
        setAiDetectedCategory,
        aiDetectedLesson,
        setAiDetectedLesson,
        aiSuggestedTags,
        setAiSuggestedTags,
        content,
        setContent,
        manualTimeLimit,
        setManualTimeLimit,
        generatedQuiz,
        setGeneratedQuiz,
        error,
        setError,
        customPrompt,
        setCustomPrompt,
        quizMode,
        setQuizMode,
        quizIntent,
        setQuizIntent,
        questionBlueprint,
        questionBlueprintV3,
        blueprintErrors,
        isBlueprintValid: blueprintErrors.length === 0,
        setQuestionBlueprint,
        aiProvider,
        setAiProvider,
        selectedTypes,
        setSelectedTypes,
        questionTypeAllocations,
        setQuestionTypeAllocations,
        difficultyLevels,
        setDifficultyLevels,
        promptProfile,
        profilePresetNotice,
        requireCode,
        setRequireCode,
        accessCode,
        setAccessCode,
        showOnHome,
        setShowOnHome,
        uploadedFile,
        setUploadedFile,
        ocrDocument,
        applyOcrDocument,
        clearOcrDocument,
        selectedOcrPageNumbers,
        setSelectedOcrPageNumbers,
        fileInputRef,
        expandedSections,
        toggleSection,
        imageLibrary,
        setImageLibrary,
        assignToClass,
        setAssignToClass,
        selectedClassId,
        setSelectedClassId,
        deadline,
        setDeadline,
        maxAttempts,
        setMaxAttempts,
        tnSearchMode,
        setTnSearchMode,
        generateRandomCode,
        handleToggleThongTu27,
        handleSelectLearnerMode,
        addTagToState,
        handleApplyAiCategory,
        handleApplyAiTitleSuggestion,
        resetAfterSave,
    };
};
