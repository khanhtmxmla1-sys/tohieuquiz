import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    SmartAssignmentRecommendedQuiz,
    SmartAssignmentWarning,
} from '../types/classroom.types';

const TEACHER_DASHBOARD_TABS = [
    'overview',
    'results',
    'manage',
    'create',
    'announcements',
    'feature-rollout',
    'classes',
    'assignments',
    'teachers',
    'gift-shop',
    'homework',
    'live-exam',
    'certificates',
    'admin-templates',
    'math-audit',
    'operations',
    'system-question-bank',
    'personal-settings',
] as const;

export type TeacherDashboardTab = typeof TEACHER_DASHBOARD_TABS[number];

const teacherDashboardTabSet = new Set<string>(TEACHER_DASHBOARD_TABS);

export const normalizeTeacherDashboardTab = (value: unknown): TeacherDashboardTab => (
    typeof value === 'string' && teacherDashboardTabSet.has(value)
        ? value as TeacherDashboardTab
        : 'overview'
);

export type AssignmentComposerDraft = {
    source: 'smart-preview' | 'manual';
    sourceResultId?: string;
    studentName?: string;
    className?: string;
    classId: string;
    studentId?: string;
    quizId: string;
    deadline: string;
    maxAttempts: number;
    weaknessSummary?: {
        skillCode: string;
        skillLabel: string;
        subskillCode?: string;
        subskillLabel?: string;
        status: 'weak' | 'needs_practice' | 'stable';
        accuracy: number;
        coveragePercent: number;
        targetDifficulty?: 1 | 2 | 3;
    };
    recommendedQuizzes?: SmartAssignmentRecommendedQuiz[];
    warnings?: SmartAssignmentWarning[];
    createdAt: string;
};

interface TeacherDashboardUIState {
    activeTab: TeacherDashboardTab;
    assignmentComposerDraft: AssignmentComposerDraft | null;
    setActiveTab: (tab: TeacherDashboardTab) => void;
    openAssignmentComposerWithDraft: (draft: AssignmentComposerDraft) => void;
    clearAssignmentComposerDraft: () => void;
}

export const useTeacherDashboardUIStore = create<TeacherDashboardUIState>()(persist((set) => ({
    activeTab: 'overview',
    assignmentComposerDraft: null,
    setActiveTab: (tab) => set({ activeTab: tab }),
    openAssignmentComposerWithDraft: (draft) => set({
        assignmentComposerDraft: draft,
        activeTab: 'assignments',
    }),
    clearAssignmentComposerDraft: () => set({ assignmentComposerDraft: null }),
}), {
    name: 'tohieuquiz_teacher_dashboard_ui',
    version: 3,
    migrate: (persistedState) => {
        const state = (persistedState || {}) as Partial<TeacherDashboardUIState>;
        return {
            ...state,
            activeTab: normalizeTeacherDashboardTab(state.activeTab),
        };
    },
    merge: (persistedState, currentState) => {
        const state = (persistedState || {}) as Partial<TeacherDashboardUIState>;
        return {
            ...currentState,
            ...state,
            activeTab: normalizeTeacherDashboardTab(state.activeTab),
        };
    },
    partialize: (state) => ({ activeTab: state.activeTab }),
}));
