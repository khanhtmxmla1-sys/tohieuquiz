import type { Question, Quiz } from '../../../types';

export interface ManualQuizSeed {
    title: string;
    classLevel: string;
    category: string;
    timeLimit: number;
    tags: string[];
    requireCode: boolean;
    accessCode?: string;
    showOnHome: boolean;
}

export interface ManualQuizNavigationState {
    manualQuizSeed?: ManualQuizSeed;
    workspaceStartedAt?: string;
}

export type ManualQuizSaveStatus =
    | 'idle'
    | 'saving-local'
    | 'saving-remote'
    | 'saved'
    | 'offline'
    | 'conflict'
    | 'error';

export type ManualQuizQuestion = Question & {
    points?: number;
    explanation?: string;
    showExplanation?: boolean;
};

export type ManualQuiz = Omit<Quiz, 'questions'> & {
    questions: ManualQuizQuestion[];
};

export type QuizEditorAccessReason = 'HAS_SUBMISSIONS' | 'LIVE_EXAM_ACTIVE' | null;

export interface QuizEditorEditability {
    mode: 'EDIT' | 'READONLY';
    canEditStructure: boolean;
    canCreateVersion: boolean;
    reason: QuizEditorAccessReason;
    requiresPublishedWarning: boolean;
    resultCount: number;
    activeLiveExamCount: number;
    openAssignmentCount: number;
}

export interface QuizEditorPayload {
    quiz: Pick<Quiz, 'id' | 'title'> & Partial<Quiz>;
    questions: unknown[];
    editability: QuizEditorEditability;
}

export interface QuizVersionResult {
    id: string;
    title: string;
    parentQuizId: string;
    versionNumber: number;
    revision: number;
    questionCount?: number;
}

export interface ManualQuizDraftEnvelope {
    schemaVersion: 1;
    draftId: string;
    quizId?: string;
    ownerUsername: string;
    revision: number;
    quiz: ManualQuiz;
    selectedQuestionId: string | null;
    targetPoints: number;
    updatedAt: string;
}
