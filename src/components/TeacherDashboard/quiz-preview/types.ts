import type { Quiz, Question } from '../../../types';

export interface QuizPreviewProps {
    quiz: Quiz | null;
    onSave: () => void;
    isSaving?: boolean;
    onUpdateQuestions?: (questions: Question[]) => void;
    onStartManual?: () => void;
    onRegenerateQuestion?: (question: Question) => Promise<Question | null>;
}
