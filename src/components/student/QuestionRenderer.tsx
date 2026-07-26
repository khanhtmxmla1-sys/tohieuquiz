import React from 'react';
import { Question } from '../../types';
import NewQuestionRenderer from '../../features/quiz-player/components/QuestionRenderer';

interface QuestionRendererProps {
    quizId?: string;
    question: Question;
    index: number;
    answers: Record<string, any>;
    onAnswerChange: (questionId: string, value: any, subId?: string) => void;
    onMatchingClick: (questionId: string, item: string, type: 'left' | 'right') => void;
}

/**
 * QuestionRenderer (Legacy Wrapper)
 *
 * This component now acts as a thin wrapper around the modular renderer.
 * @deprecated Use src/features/quiz-player/components/QuestionRenderer instead.
 */
const QuestionRenderer: React.FC<QuestionRendererProps> = (props) => (
    <NewQuestionRenderer {...props} />
);

export default React.memo(QuestionRenderer);
