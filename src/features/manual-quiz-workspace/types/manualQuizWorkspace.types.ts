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
