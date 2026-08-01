import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Quiz, StudentResult } from '../src/types';
import { callApi } from '../src/services/apiAdapter';
import { serializeQuizForSave } from '../src/domain/quiz/quizSerializer';
import { cacheService } from '../src/services/CacheService';
import { filterActiveQuizzes, isArchivedQuizCategory } from '../src/domain/quiz/quizCategoryPolicy';
import {
    isQuizCatalogFresh,
    type QuizLoadOptions,
} from '../src/domain/quiz/quizLoadPolicy';
import { logger } from '../src/services/logger';

let activeQuizLoad: Promise<void> | null = null;

type ViewType = 'home' | 'student' | 'teacher_login' | 'teacher_dash' | 'student_portal' | 'shop';

const parseMultipleSelectAnswersForQuestion = (raw: any): string[] => {
    if (Array.isArray(raw)) {
        return raw.map((v: any) => String(v).trim().toUpperCase()).filter(Boolean);
    }

    if (raw === undefined || raw === null) return [];

    const str = String(raw).trim();
    if (!str) return [];

    const normalized = str.startsWith("'") ? str.substring(1).trim() : str;
    if (normalized.startsWith('[') && normalized.endsWith(']')) {
        try {
            const parsed = JSON.parse(normalized);
            if (Array.isArray(parsed)) {
                return parsed.map((v: any) => String(v).trim().toUpperCase()).filter(Boolean);
            }
        } catch {
            // Fall through to pipe format.
        }
    }

    return normalized.split('|').map((v: string) => v.trim().toUpperCase()).filter(Boolean);
};

export const normalizeQuestionRow = (q: any): any => {
    const parsed = { ...q };
    if (typeof q.items === 'string') try { parsed.items = JSON.parse(q.items); } catch { }
    if (typeof q.pairs === 'string') try { parsed.pairs = JSON.parse(q.pairs); } catch { }
    if (typeof q.categories === 'string') try { parsed.categories = JSON.parse(q.categories); } catch { }
    if (typeof q.blanks === 'string') try { parsed.blanks = JSON.parse(q.blanks); } catch { }
    if (typeof q.distractors === 'string') try { parsed.distractors = JSON.parse(q.distractors); } catch { }
    if (typeof q.options === 'string') parsed.options = q.options.split('|');
    if (typeof q.correctAnswers === 'string') try { parsed.correctAnswers = JSON.parse(q.correctAnswers); } catch { }
    if (typeof q.letters === 'string') try { parsed.letters = JSON.parse(q.letters); } catch { }
    if (typeof q.riddleLines === 'string') try { parsed.riddleLines = JSON.parse(q.riddleLines); } catch { }
    if (typeof q.words === 'string') try { parsed.words = JSON.parse(q.words); } catch { }
    if (typeof q.correctWordIndexes === 'string') try { parsed.correctWordIndexes = JSON.parse(q.correctWordIndexes); } catch { }
    if (typeof q.correctOrder === 'string') try { parsed.correctOrder = JSON.parse(q.correctOrder); } catch { }
    if (typeof q.optionImages === 'string') try { parsed.optionImages = JSON.parse(q.optionImages); } catch { }
    if (typeof q.left_items === 'string') try { parsed.leftItems = JSON.parse(q.left_items); } catch { }
    if (typeof q.right_items === 'string') try { parsed.rightItems = JSON.parse(q.right_items); } catch { }

    parsed.quizId = parsed.quizId || parsed.quiz_id;
    parsed.correctAnswer = parsed.correctAnswer || parsed.correct_answer;
    parsed.mainQuestion = parsed.mainQuestion || parsed.main_question || parsed.question;
    parsed.correctWord = parsed.correctWord || parsed.correct_word;
    parsed.correctWordIndexes = parsed.correctWordIndexes || parsed.correct_word_indexes;
    parsed.text = parsed.text || parsed.text_field;

    if (typeof parsed.question === 'string' && /^'\d+\s*\/\s*\d+/.test(parsed.question)) {
        parsed.question = parsed.question.substring(1);
    }
    if (typeof parsed.mainQuestion === 'string' && /^'\d+\s*\/\s*\d+/.test(parsed.mainQuestion)) {
        parsed.mainQuestion = parsed.mainQuestion.substring(1);
    }

    const qType = parsed.type;
    if (qType === 'IMAGE_QUESTION') {
        parsed.optionImages = parsed.distractors || [];
    } else if (qType === 'UNDERLINE') {
        parsed.words = parsed.items || [];
        let parsedIndexes = [];
        try {
            parsedIndexes = typeof parsed.correctAnswer === 'string' ? JSON.parse(parsed.correctAnswer) : parsed.correctAnswer;
        } catch (e) { }
        parsed.correctWordIndexes = Array.isArray(parsedIndexes) ? parsedIndexes : [];
    } else if (qType === 'RIDDLE') {
        parsed.riddleLines = parsed.items || [];
        parsed.answerLabel = parsed.text || '';
        parsed.hint = parsed.sentence || '';
    } else if (qType === 'CATEGORIZATION') {
        parsed.categories = parsed.distractors || [];
    } else if (qType === 'WORD_SCRAMBLE') {
        parsed.letters = parsed.items || [];
        parsed.correctWord = parsed.correctAnswer || '';
        parsed.hint = parsed.text || '';
    } else if (qType === 'ERROR_CORRECTION') {
        parsed.passage = parsed.text || '';
        parsed.wrongWord = parsed.distractors || '';
        parsed.correctWord = parsed.correctAnswer || '';
    } else if (qType === 'MATCHING') {
        parsed.pairs = parsed.items || [];
        parsed.leftItems = Array.isArray(parsed.leftItems) ? parsed.leftItems : [];
        parsed.rightItems = Array.isArray(parsed.rightItems) ? parsed.rightItems : [];
    } else if (qType === 'MULTIPLE_SELECT') {
        const sourceCorrect = parsed.correctAnswers ?? parsed.correctAnswer;
        parsed.correctAnswers = parseMultipleSelectAnswersForQuestion(sourceCorrect);
        if (!parsed.correctAnswer && parsed.correctAnswers.length > 0) {
            parsed.correctAnswer = JSON.stringify(parsed.correctAnswers);
        }
    }

    parsed.options = Array.isArray(parsed.options) ? parsed.options : [];
    parsed.items = Array.isArray(parsed.items) ? parsed.items : [];
    parsed.pairs = Array.isArray(parsed.pairs) ? parsed.pairs : [];
    parsed.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    parsed.blanks = Array.isArray(parsed.blanks) ? parsed.blanks : [];
    parsed.distractors = Array.isArray(parsed.distractors) ? parsed.distractors : [];
    parsed.letters = Array.isArray(parsed.letters) ? parsed.letters : [];
    parsed.riddleLines = Array.isArray(parsed.riddleLines) ? parsed.riddleLines : [];
    parsed.words = Array.isArray(parsed.words) ? parsed.words : [];
    parsed.correctWordIndexes = Array.isArray(parsed.correctWordIndexes) ? parsed.correctWordIndexes : [];
    parsed.correctOrder = Array.isArray(parsed.correctOrder) ? parsed.correctOrder : [];
    parsed.optionImages = Array.isArray(parsed.optionImages) ? parsed.optionImages : [];
    parsed.correctAnswers = Array.isArray(parsed.correctAnswers) ? parsed.correctAnswers : [];

    return parsed;
};

interface QuizState {
    // State
    view: ViewType;
    quizzes: Quiz[];
    selectedQuiz: Quiz | null;
    selectedClassLevel: string | null;
    selectedCategory: string | null;
    results: StudentResult[];
    isLoading: boolean;
    error: string | null;
    quizzesLoadedAt: number | null;

    // View actions
    setView: (view: ViewType) => void;
    goHome: () => void;

    // Quiz actions
    setQuizzes: (quizzes: Quiz[]) => void;
    addQuiz: (quiz: Quiz) => void;
    updateQuiz: (quiz: Quiz) => void;
    deleteQuiz: (id: string) => void;
    selectQuiz: (quiz: Quiz | null) => void;
    setClassLevel: (level: string | null) => void;
    setCategory: (category: string | null) => void;

    // Results actions
    setResults: (results: StudentResult[]) => void;
    addResult: (result: StudentResult) => void;

    // UI actions
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Async Actions
    loadQuizzes: (options?: QuizLoadOptions) => Promise<void>;
    loadQuizQuestions: (quizId: string) => Promise<Quiz | null>;
    loadResults: () => Promise<void>;
    createQuiz: (quiz: Quiz) => Promise<void>;
    modifyQuiz: (quiz: Quiz) => Promise<void>;
    removeQuiz: (id: string) => Promise<void>;
    duplicateQuiz: (quizId: string) => Promise<boolean>;
    submitResult: (result: StudentResult) => Promise<StudentResult>;
    removeResult: (id: string) => Promise<void>;
}

export const useQuizStore = create<QuizState>()(
    persist(
        (set, get) => ({
            // Initial state
            view: 'home',
            quizzes: [],
            selectedQuiz: null,
            selectedClassLevel: null,
            selectedCategory: null,
            results: [],
            isLoading: false,
            error: null,
            quizzesLoadedAt: null,

            // View actions
            setView: (view) => set({ view }),
            goHome: () => set({
                view: 'home',
                selectedQuiz: null,
                selectedClassLevel: null,
                selectedCategory: null
            }),

            // Quiz actions
            setQuizzes: (quizzes) => set({ quizzes: filterActiveQuizzes(quizzes) }),
            addQuiz: (quiz) => {
                if (isArchivedQuizCategory(quiz.category)) return;
                set((state) => ({ quizzes: [...state.quizzes, quiz] }));
            },
            updateQuiz: (quiz) => set((state) => ({
                quizzes: isArchivedQuizCategory(quiz.category)
                    ? state.quizzes.filter((item) => item.id !== quiz.id)
                    : state.quizzes.map(q => q.id === quiz.id ? quiz : q)
            })),
            deleteQuiz: (id) => set((state) => ({
                quizzes: state.quizzes.filter(q => q.id !== id)
            })),
            selectQuiz: (quiz) => {
                const activeQuiz = quiz && !isArchivedQuizCategory(quiz.category) ? quiz : null;
                set({ selectedQuiz: activeQuiz });
                if (activeQuiz && (!Array.isArray(activeQuiz.questions) || activeQuiz.questions.length === 0)) {
                    void get().loadQuizQuestions(activeQuiz.id);
                }
            },
            setClassLevel: (level) => set({ selectedClassLevel: level, selectedCategory: null }),
            setCategory: (category) => set({
                selectedCategory: isArchivedQuizCategory(category) ? null : category,
            }),

            // Results actions
            setResults: (results) => set({ results }),
            addResult: (result) => set((state) => ({
                results: [...state.results, result]
            })),

            // UI actions
            setLoading: (isLoading) => set({ isLoading }),
            setError: (error) => set({ error }),

            // Duplicate quiz
            duplicateQuiz: async (quizId: string) => {
                try {
                    const res = await callApi<any>('duplicate_quiz', { quizId });
                    if (res?.status === 'success') {
                        // Reload to get the new quiz with all questions
                        await get().loadQuizzes({ force: true });
                        return true;
                    }
                    return false;
                } catch (err) {
                    console.error('[QuizStore] duplicateQuiz error:', err);
                    return false;
                }
            },

            // Async Actions - All routes through Cloudflare Workers D1
            loadQuizzes: (options = {}) => {
                const state = get();
                const force = options.force === true;

                if (!force && isQuizCatalogFresh({
                    hasQuizzes: state.quizzes.length > 0,
                    loadedAt: state.quizzesLoadedAt,
                    now: Date.now(),
                    maxAgeMs: options.maxAgeMs,
                })) {
                    return Promise.resolve();
                }

                if (force) {
                    cacheService.invalidatePrefix('quizzes:');
                }

                if (activeQuizLoad) return activeQuizLoad;

                const request = (async () => {
                    set({ isLoading: true, error: null });
                    try {
                        const [quizData, questionData] = await Promise.all([
                            callApi<any[]>('get_quizzes'),
                            callApi<any[]>('get_questions'),
                        ]);

                        if (!Array.isArray(quizData)) {
                            set({ quizzes: [], isLoading: false, quizzesLoadedAt: null });
                            return;
                        }

                        const existingById = new Map(
                            get().quizzes.map((quiz) => [quiz.id, quiz]),
                        );
                        const questionsByQuizId = new Map<string, any[]>();

                        if (Array.isArray(questionData)) {
                            questionData.forEach((row: any) => {
                                const question = normalizeQuestionRow(row);
                                const quizId = question.quizId || row.quiz_id;
                                if (!quizId) return;

                                const questions = questionsByQuizId.get(quizId) || [];
                                questions.push(question);
                                questionsByQuizId.set(quizId, questions);
                            });
                        }

                        const quizzes: Quiz[] = filterActiveQuizzes(quizData).map((row: any) => ({
                            id: row.id,
                            title: row.title || '',
                            classLevel: row.classLevel || row.class_level || '',
                            category: row.category || '',
                            timeLimit: parseInt(row.timeLimit || row.time_limit) || 30,
                            createdAt: row.createdAt || row.created_at || new Date().toISOString(),
                            createdBy: row.createdBy || row.created_by || '',
                            accessCode: row.accessCode || row.access_code || undefined,
                            requireCode:
                                row.requireCode === true
                                || row.requireCode === 'TRUE'
                                || row.requireCode === 1
                                || row.require_code === true
                                || row.require_code === 'TRUE'
                                || row.require_code === 1,
                            showOnHome: !(
                                row.showOnHome === false
                                || row.showOnHome === 'FALSE'
                                || row.showOnHome === 0
                                || row.show_on_home === false
                                || row.show_on_home === 'FALSE'
                                || row.show_on_home === 0
                            ),
                            tags: (() => {
                                if (typeof row.tags === 'string') {
                                    try {
                                        return JSON.parse(row.tags);
                                    } catch {
                                        return [];
                                    }
                                }
                                return Array.isArray(row.tags) ? row.tags : [];
                            })(),
                            sourceType: row.sourceType || row.source_type || 'manual',
                            parentQuizId: row.parentQuizId || row.parent_quiz_id || null,
                            versionNumber: Number(row.versionNumber || row.version_number || 1),
                            revision: Number(row.revision || 1),
                            updatedAt: row.updatedAt || row.updated_at || row.createdAt || row.created_at,
                            questions:
                                questionsByQuizId.get(row.id)
                                || existingById.get(row.id)?.questions
                                || [],
                        }));

                        const currentSelectedQuiz = get().selectedQuiz;
                        const updatedSelectedQuiz = currentSelectedQuiz
                            ? quizzes.find((quiz) => quiz.id === currentSelectedQuiz.id) || null
                            : null;

                        logger.debug(`Loaded ${quizzes.length} quizzes from D1`, {
                            module: 'QuizStore',
                        });
                        set({
                            quizzes,
                            selectedQuiz: updatedSelectedQuiz,
                            isLoading: false,
                            quizzesLoadedAt: Date.now(),
                        });
                    } catch (err: any) {
                        set({
                            error: err.message || 'Failed to load quizzes',
                            isLoading: false,
                            quizzesLoadedAt: null,
                        });
                    }
                })();

                activeQuizLoad = request.finally(() => {
                    activeQuizLoad = null;
                });
                return activeQuizLoad;
            },

            loadQuizQuestions: async (quizId: string) => {
                const currentQuiz = get().quizzes.find(q => q.id === quizId) || get().selectedQuiz;
                if (currentQuiz?.id === quizId && Array.isArray(currentQuiz.questions) && currentQuiz.questions.length > 0) {
                    return currentQuiz;
                }

                set({ isLoading: true, error: null });
                try {
                    const questionData = await callApi<any[]>('get_questions', { quizId });
                    const questions = Array.isArray(questionData) ? questionData.map(normalizeQuestionRow) : [];
                    let loadedQuiz: Quiz | null = null;

                    set((state) => {
                        const quizzes = state.quizzes.map((quiz) => {
                            if (quiz.id !== quizId) return quiz;
                            loadedQuiz = { ...quiz, questions };
                            return loadedQuiz;
                        });

                        const selectedQuiz = state.selectedQuiz?.id === quizId
                            ? { ...state.selectedQuiz, questions }
                            : state.selectedQuiz;

                        if (!loadedQuiz && selectedQuiz?.id === quizId) {
                            loadedQuiz = selectedQuiz;
                        }

                        return { quizzes, selectedQuiz, isLoading: false };
                    });

                    return loadedQuiz;
                } catch (err: any) {
                    set({ error: err.message || 'Failed to load quiz questions', isLoading: false });
                    throw err;
                }
            },

            loadResults: async () => {
                try {
                    set({ error: null });
                    const data = await callApi<any>('get_results');

                    // Handle both legacy array format and new object format { data: [], meta: {} }
                    const rawResults = Array.isArray(data) ? data : (data?.data || []);

                    if (!Array.isArray(rawResults)) {
                        set({ results: [], error: null });
                        return;
                    }
                    const results: StudentResult[] = rawResults.map((row: any) => ({
                        id: row.id || `result-${Date.now()}`,
                        studentName: row.studentName || row.name || row['Student Name'] || '',
                        studentClass: row.studentClass || row.className || row['Class'] || '',
                        quizId: row.quizId || row.quiz_id || row['Quiz ID'] || '',
                        quizTitle: row.quizTitle || row.quiz_title || row['Quiz Title'] || '',
                        score: parseFloat(String(row.score || row['Score'] || 0).replace(',', '.')) || 0,
                        correctCount: parseInt(row.correctCount || row.correct_count) || 0,
                        totalQuestions: parseInt(row.totalQuestions || row.total_questions || row['Total Questions']) || 0,
                        submittedAt: row.submittedAt || row.submitted_at || row['Submitted At'] || new Date().toISOString(),
                        timeTaken: parseInt(row.timeTaken || row.time_taken || row['Time Taken']) || 0,
                        answers: (() => {
                            if (typeof row.answers === 'string') {
                                try { return JSON.parse(row.answers || '{}'); } catch { return {}; }
                            }
                            return row.answers || {};
                        })()
                    })).filter(r => !!r.studentName);
                    set({ results, error: null });
                } catch (err: any) {
                    console.error('Failed to load results:', err);
                    set({
                        error: err?.message || 'Không thể tải kết quả học tập.',
                    });
                }
            },

            createQuiz: async (quiz) => {
                if (isArchivedQuizCategory(quiz.category)) {
                    throw new Error('Danh mục đề thi này đã được lưu trữ và không còn được hỗ trợ.');
                }
                set({ isLoading: true, error: null });
                try {
                    const prepared = serializeQuizForSave(quiz);
                    const result = await callApi('create_quiz', prepared);
                    if (result && result.status === 'success') {
                        cacheService.invalidatePrefix('quizzes:');
                        set((state) => ({
                            quizzes: [...state.quizzes, quiz],
                            isLoading: false
                        }));
                    } else {
                        throw new Error(result?.message || 'Failed to save quiz');
                    }
                } catch (err: any) {
                    set({ error: err.message, isLoading: false });
                    throw err;
                }
            },

            modifyQuiz: async (quiz) => {
                if (isArchivedQuizCategory(quiz.category)) {
                    throw new Error('Danh mục đề thi này đã được lưu trữ và không còn được hỗ trợ.');
                }
                set({ isLoading: true, error: null });
                try {
                    const prepared = serializeQuizForSave(quiz);
                    const result = await callApi('update_quiz', { ...prepared, id: quiz.id });
                    if (result && result.status === 'success') {
                        cacheService.invalidatePrefix('quizzes:');
                        const updatedQuiz = {
                            ...quiz,
                            revision: Number(result.revision || quiz.revision || 1),
                            updatedAt: result.updatedAt || quiz.updatedAt,
                        };
                        set((state) => ({
                            quizzes: state.quizzes.map(q => q.id === quiz.id ? updatedQuiz : q),
                            selectedQuiz: state.selectedQuiz?.id === quiz.id ? updatedQuiz : state.selectedQuiz,
                            isLoading: false
                        }));
                    } else {
                        throw new Error(result?.message || 'Failed to update quiz');
                    }
                } catch (err: any) {
                    set({ error: err.message, isLoading: false });
                    throw err;
                }
            },

            removeQuiz: async (id) => {
                set({ isLoading: true, error: null });
                try {
                    const result = await callApi('delete_quiz', { id });
                    if (result && result.status === 'success') {
                        cacheService.invalidatePrefix('quizzes:');
                        set((state) => ({
                            quizzes: state.quizzes.filter(q => q.id !== id),
                            isLoading: false
                        }));
                    } else {
                        throw new Error(result?.message || 'Failed to delete quiz');
                    }
                } catch (err: any) {
                    set({ error: err.message, isLoading: false });
                    throw err;
                }
            },

            submitResult: async (result) => {
                try {
                    const res = await callApi<{ status: string; resultId?: number }>('submit_result', {
                        ...result,
                        className: result.studentClass,
                        quizTitle: result.quizTitle || 'Unknown Quiz'
                    });
                    if (res && res.status === 'success') {
                        cacheService.invalidatePrefix('results:');
                        // Update result with server-generated ID
                        const updatedResult = res.resultId ? { ...result, id: String(res.resultId) } : result;
                        set((state) => ({
                            results: [...state.results, updatedResult]
                        }));
                        return updatedResult;
                    } else {
                        throw new Error('Không thể lưu kết quả. Vui lòng thử lại!');
                    }
                } catch (err) {
                    console.error('Failed to submit result:', err);
                    throw err;
                }
            },

            removeResult: async (id) => {
                set({ isLoading: true, error: null });
                try {
                    const result = await callApi('delete_result', { resultId: id });
                    if (result && result.status === 'success') {
                        cacheService.invalidatePrefix('results:');
                        set((state) => ({
                            results: state.results.filter(r => r.id !== id),
                            isLoading: false
                        }));
                    } else {
                        throw new Error('Failed to delete result');
                    }
                } catch (err: any) {
                    set({ error: err.message, isLoading: false });
                    throw err;
                }
            }
        }),
        {
            name: 'tohieuquiz-store',
            storage: createJSONStorage(() => localStorage),
            merge: (persistedState, currentState) => {
                const state = (persistedState || {}) as Partial<QuizState>;
                return {
                    ...currentState,
                    ...state,
                    quizzes: filterActiveQuizzes(state.quizzes || currentState.quizzes),
                };
            },
            // Only persist selected fields to avoid stale data
            // NOTE: Do NOT persist selectedClassLevel - it should reset when returning home
            partialize: (state) => ({
                // Persist quizzes locally for offline access
                quizzes: filterActiveQuizzes(state.quizzes),
                // Persist view state so teacher dashboard stays after F5 refresh
                view: state.view,
            }),
        }
    )
);

