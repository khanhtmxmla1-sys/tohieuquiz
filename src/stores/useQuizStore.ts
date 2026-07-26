/**
 * Quiz Store
 *
 * Zustand store for Quiz management.
 * Handles quizzes, results, and teacher data.
 */

import { create } from 'zustand';
import type { Quiz, StudentResult, Teacher } from '../types';

interface QuizStore {
    // State
    quizzes: Quiz[];
    results: StudentResult[];
    teachers: Teacher[];
    isLoading: boolean;
    error: string | null;

    // Quiz actions
    setQuizzes: (quizzes: Quiz[]) => void;
    addQuiz: (quiz: Quiz) => void;
    updateQuiz: (id: string, updates: Partial<Quiz>) => void;
    deleteQuiz: (id: string) => void;
    getQuizById: (id: string) => Quiz | undefined;

    // Result actions
    setResults: (results: StudentResult[]) => void;
    addResult: (result: StudentResult) => void;
    deleteResult: (id: string) => void;
    getResultsByQuizId: (quizId: string) => StudentResult[];

    // Teacher actions
    setTeachers: (teachers: Teacher[]) => void;
    getTeacherByUsername: (username: string) => Teacher | undefined;

    // Utilities
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
}

export const useQuizStore = create<QuizStore>((set, get) => ({
    // Initial state
    quizzes: [],
    results: [],
    teachers: [],
    isLoading: false,
    error: null,

    // Quiz actions
    setQuizzes: (quizzes) => set({ quizzes }),

    addQuiz: (quiz) => set((state) => ({
        quizzes: [...state.quizzes, quiz]
    })),

    updateQuiz: (id, updates) => set((state) => ({
        quizzes: state.quizzes.map((q) =>
            q.id === id ? { ...q, ...updates } : q
        )
    })),

    deleteQuiz: (id) => set((state) => ({
        quizzes: state.quizzes.filter((q) => q.id !== id)
    })),

    getQuizById: (id) => {
        return get().quizzes.find((q) => q.id === id);
    },

    // Result actions
    setResults: (results) => set({ results }),

    addResult: (result) => set((state) => ({
        results: [...state.results, result]
    })),

    deleteResult: (id) => set((state) => ({
        results: state.results.filter((r) => r.id !== id)
    })),

    getResultsByQuizId: (quizId) => {
        return get().results.filter((r) => r.quizId === quizId);
    },

    // Teacher actions
    setTeachers: (teachers) => set({ teachers }),

    getTeacherByUsername: (username) => {
        return get().teachers.find((t) => t.username === username);
    },

    // Utilities
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
}));
