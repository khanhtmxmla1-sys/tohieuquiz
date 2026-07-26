/**
 * ShortAnswerRenderer.tsx
 * Renders a Short Answer question in read-only mode.
 */
import React from 'react';
import type { ShortAnswerQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface ShortAnswerRendererProps {
    question: ShortAnswerQuestion;
}

const ShortAnswerRenderer: React.FC<ShortAnswerRendererProps> = ({ question }) => (
    <div className="ml-8">
        <p className="text-sm text-gray-600">
            Đáp án:{' '}
            <NewlineMathText
                content={question.correctAnswer}
                as="span"
                className="font-bold text-green-700 quiz-text-preserve-inline"
            />
        </p>
    </div>
);

export default React.memo(ShortAnswerRenderer);
