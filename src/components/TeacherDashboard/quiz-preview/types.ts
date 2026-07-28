import type { Quiz, Question } from '../../../types';
import type { AiQuestionQualitySummary } from '../../../../shared/ai-question-quality.contract';

export interface QuizPreviewProps {
    quiz: Quiz | null;
    onSave: () => void;
    isSaving?: boolean;
    onUpdateQuestions?: (questions: Question[]) => void;
    onStartManual?: () => void;
    onRegenerateQuestion?: (question: Question) => Promise<Question | null>;
    qualitySummary?: AiQuestionQualitySummary | null;
    acknowledgedWarningIds?: ReadonlySet<string>;
    onToggleQualityWarning?: (issueId: string) => void;
    canSave?: boolean;
    saveBlockReason?: string | null;
}
