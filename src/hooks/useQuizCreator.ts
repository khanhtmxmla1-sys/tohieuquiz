/**
 * useQuizCreator Hook
 * 
 * Custom hook for quiz creation form state and logic.
 * Extracts state management from TeacherDashboard.
 */

import { useState, useCallback } from 'react';
import { QuestionType, Quiz, Question, ImageLibraryItem } from '../types';
import { generateQuiz, QuizGenerationOptions, AIProvider } from '../services/geminiService';

export interface DifficultyLevels {
    level1: number;
    level2: number;
    level3: number;
}

export interface QuizCreatorState {
    // Form fields
    topic: string;
    quizTitle: string;
    classLevel: string;
    content: string;
    questionCount: number;
    selectedTypes: Record<string, boolean>;
    manualTimeLimit: number | '';
    difficultyLevels: DifficultyLevels;
    requireCode: boolean;
    accessCode: string;

    // Files
    attachedFiles: File[];
    imageLibrary: ImageLibraryItem[];

    // Generated quiz
    generatedQuiz: Quiz | null;

    // UI state
    isGenerating: boolean;
    error: string | null;

    // AI Provider
    aiProvider: AIProvider;
}

export interface UseQuizCreatorReturn extends QuizCreatorState {
    // Setters
    setTopic: (value: string) => void;
    setQuizTitle: (value: string) => void;
    setClassLevel: (value: string) => void;
    setContent: (value: string) => void;
    setQuestionCount: (value: number) => void;
    setSelectedTypes: (value: Record<string, boolean>) => void;
    setManualTimeLimit: (value: number | '') => void;
    setDifficultyLevels: (value: DifficultyLevels) => void;
    setRequireCode: (value: boolean) => void;
    setAccessCode: (value: string) => void;
    setAttachedFiles: (files: File[]) => void;
    setImageLibrary: (items: ImageLibraryItem[]) => void;
    setAiProvider: (provider: AIProvider) => void;
    setGeneratedQuiz: (quiz: Quiz | null) => void;

    // Actions
    handleGenerate: () => Promise<void>;
    generateRandomCode: () => string;
    resetForm: () => void;
    updateQuestionImage: (questionId: string, imageUrl: string) => void;
}

const DEFAULT_SELECTED_TYPES = {
    [QuestionType.MCQ]: true,
    [QuestionType.TRUE_FALSE]: true,
    [QuestionType.SHORT_ANSWER]: true,
    [QuestionType.MATCHING]: true,
};

const DEFAULT_DIFFICULTY: DifficultyLevels = {
    level1: 3,
    level2: 5,
    level3: 2,
};

export const useQuizCreator = (): UseQuizCreatorReturn => {
    // Form state
    const [topic, setTopic] = useState('');
    const [quizTitle, setQuizTitle] = useState('');
    const [classLevel, setClassLevel] = useState('3');
    const [content, setContent] = useState('');
    const [questionCount, setQuestionCount] = useState(10);
    const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>(DEFAULT_SELECTED_TYPES);
    const [manualTimeLimit, setManualTimeLimit] = useState<number | ''>('');
    const [difficultyLevels, setDifficultyLevels] = useState(DEFAULT_DIFFICULTY);
    const [requireCode, setRequireCode] = useState(false);
    const [accessCode, setAccessCode] = useState('');

    // Files
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [imageLibrary, setImageLibrary] = useState<ImageLibraryItem[]>(() => {
        const saved = localStorage.getItem('quiz_image_library');
        return saved ? JSON.parse(saved) : [];
    });

    // Generated quiz
    const [generatedQuiz, setGeneratedQuiz] = useState<Quiz | null>(null);

    // UI state
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AI Provider
    const [aiProvider, setAiProvider] = useState<AIProvider>(() =>
        (localStorage.getItem('ai_provider') as AIProvider) || 'llm-mux'
    );

    // Generate random access code
    const generateRandomCode = useCallback((): string => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setAccessCode(code);
        return code;
    }, []);

    // Update question image
    const updateQuestionImage = useCallback((questionId: string, imageUrl: string) => {
        if (!generatedQuiz) return;

        setGeneratedQuiz({
            ...generatedQuiz,
            questions: generatedQuiz.questions.map(q =>
                q.id === questionId ? { ...q, image: imageUrl } : q
            )
        });
    }, [generatedQuiz]);

    // Reset form
    const resetForm = useCallback(() => {
        setTopic('');
        setQuizTitle('');
        setContent('');
        setAttachedFiles([]);
        setSelectedTypes(DEFAULT_SELECTED_TYPES);
        setQuestionCount(10);
        setManualTimeLimit('');
        setDifficultyLevels(DEFAULT_DIFFICULTY);
        setRequireCode(false);
        setAccessCode('');
        setGeneratedQuiz(null);
        setError(null);
    }, []);

    // Handle quiz generation
    const handleGenerate = useCallback(async () => {
        if (!topic.trim()) {
            setError('Vui lòng nhập chủ đề.');
            return;
        }

        const selectedTypesList = Object.entries(selectedTypes)
            .filter(([_, selected]) => selected)
            .map(([type]) => type as QuestionType);

        if (selectedTypesList.length === 0) {
            setError('Vui lòng chọn ít nhất một loại câu hỏi.');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const options: QuizGenerationOptions = {
                title: quizTitle || `Kiểm tra: ${topic}`,
                questionCount,
                questionTypes: selectedTypesList,
                difficultyLevels: {
                    level1: difficultyLevels.level1,
                    level2: difficultyLevels.level2,
                    level3: difficultyLevels.level3,
                },
                imageLibrary: imageLibrary.map(img => ({
                    id: img.id,
                    name: img.name,
                    data: img.data,
                })),
            };

            const result = await generateQuiz(
                topic,
                classLevel,
                content,
                attachedFiles[0] || null,
                options,
                undefined,
                aiProvider
            );

            // Normalize quiz
            const normalizedQuiz: Quiz = {
                id: `quiz-${Date.now()}`,
                title: result.title || options.title,
                classLevel,
                timeLimit: typeof manualTimeLimit === 'number' ? manualTimeLimit : result.timeLimit || 15,
                questions: (result.questions || []).map((q: any, idx: number) => ({
                    ...q,
                    id: q.id || `q-${Date.now()}-${idx}`,
                })),
                createdAt: new Date().toISOString(),
                accessCode: requireCode ? accessCode : undefined,
                requireCode,
            };

            setGeneratedQuiz(normalizedQuiz);
        } catch (err: unknown) {
            const normalizedError = err instanceof Error ? err : new Error(String(err));
            console.error('Quiz generation error:', err);
            setError(normalizedError.message || 'Đã xảy ra lỗi khi tạo đề.');
        } finally {
            setIsGenerating(false);
        }
    }, [
        topic, quizTitle, classLevel, content, questionCount,
        selectedTypes, difficultyLevels, imageLibrary, attachedFiles,
        manualTimeLimit, requireCode, accessCode, aiProvider
    ]);

    return {
        // State
        topic,
        quizTitle,
        classLevel,
        content,
        questionCount,
        selectedTypes,
        manualTimeLimit,
        difficultyLevels,
        requireCode,
        accessCode,
        attachedFiles,
        imageLibrary,
        generatedQuiz,
        isGenerating,
        error,
        aiProvider,

        // Setters
        setTopic,
        setQuizTitle,
        setClassLevel,
        setContent,
        setQuestionCount,
        setSelectedTypes,
        setManualTimeLimit,
        setDifficultyLevels,
        setRequireCode,
        setAccessCode,
        setAttachedFiles,
        setImageLibrary,
        setAiProvider,
        setGeneratedQuiz,

        // Actions
        handleGenerate,
        generateRandomCode,
        resetForm,
        updateQuestionImage,
    };
};

export default useQuizCreator;
