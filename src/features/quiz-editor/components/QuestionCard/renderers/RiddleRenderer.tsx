/**
 * RiddleRenderer.tsx
 * Renders a Riddle (câu đố) question in read-only mode.
 */
import React from 'react';
import type { RiddleQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface RiddleRendererProps {
    question: RiddleQuestion;
}

const RiddleRenderer: React.FC<RiddleRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-2">
        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
            {question.riddleLines.map((line, i) => (
                <p key={i} className="text-amber-900 italic text-sm">
                    <NewlineMathText content={line} as="span" className="quiz-text-preserve-inline" />
                </p>
            ))}
        </div>
        <p className="text-sm">
            <span className="text-gray-500">
                <NewlineMathText
                    content={question.answerLabel || 'Đáp án'}
                    as="span"
                    className="quiz-text-preserve-inline"
                />
                :
            </span>
            <NewlineMathText
                content={question.correctAnswer}
                as="span"
                className="font-bold text-green-700 ml-2 quiz-text-preserve-inline"
            />
        </p>
    </div>
);

export default React.memo(RiddleRenderer);
