import { Question } from '../../../../types';
import type { RandomizationPolicy } from '../../../../../shared/randomization-policy.contract';

export interface BaseRendererProps {
    quizId?: string;
    question: Question;
    index: number;
    answers: Record<string, any>;
    onAnswerChange: (questionId: string, value: any, subId?: string) => void;
    onMatchingClick?: (questionId: string, item: string, type: 'left' | 'right') => void;
    randomizationPolicy?: RandomizationPolicy;
}
