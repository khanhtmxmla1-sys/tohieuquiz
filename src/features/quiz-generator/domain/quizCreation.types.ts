import type { Quiz } from '../../../types';
import type { AIProvider, PromptProfileOptions } from '../../../services/geminiService';
import type { QuestionTypeAllocation, QuizIntent, QuizSourceMode } from './quizBlueprint';

export type QuizMode = 'exam' | 'practice' | 'pdf';
export type GenerationStep =
    | 'idle'
    | 'reading_document'
    | 'generating'
    | 'reviewing'
    | 'repairing'
    | 'completed'
    | 'cancelled';
export type TrangNguyenSearchMode = 'search' | 'quick';

export interface DifficultyLevels {
    level1: number;
    level2: number;
    level3: number;
}

export interface ExpandedSections {
    basic: boolean;
    questionTypes: boolean;
    difficulty: boolean;
    pedagogy: boolean;
    content: boolean;
    advanced: boolean;
    assign: boolean;
    [key: string]: boolean;
}

export interface UseCreateQuizLogicProps {
    editingQuiz: Quiz | null;
    onSaveQuiz: (quiz: Quiz) => Promise<void>;
    onUpdateQuiz: (quiz: Quiz) => Promise<void>;
    onSuccess: () => void;
}

export interface QuizGenerationFormSnapshot {
    topic: string;
    quizTitle: string;
    classLevel: string;
    category: string;
    tags: string[];
    content: string;
    manualTimeLimit: number | '';
    customPrompt: string;
    quizMode: QuizMode;
    quizIntent?: QuizIntent;
    sourceMode?: QuizSourceMode;
    aiProvider: AIProvider;
    selectedTypes: Record<string, boolean>;
    questionTypeAllocations?: QuestionTypeAllocation[];
    difficultyLevels: DifficultyLevels;
    promptProfile: PromptProfileOptions;
    requireCode: boolean;
    accessCode: string;
    showOnHome: boolean;
    uploadedFile: File | null;
}
