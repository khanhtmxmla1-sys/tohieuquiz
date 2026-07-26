/**
 * UnderlineRenderer.tsx
 * Renders an Underline (gạch chân từ đúng) question in read-only mode.
 */
import React from 'react';
import type { UnderlineQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface UnderlineRendererProps {
    question: UnderlineQuestion;
}

const UnderlineRenderer: React.FC<UnderlineRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-2">
        <p className="text-sm text-gray-600 mb-2">
            <strong>Câu:</strong>{' '}
            <NewlineMathText
                content={question.sentence}
                as="span"
                className="quiz-text-preserve-inline"
            />
        </p>
        <div className="flex flex-wrap gap-2">
            {question.words.map((word, i) => {
                const isCorrect = question.correctWordIndexes.includes(i);
                return (
                    <span
                        key={i}
                        className={`px-2 py-1 rounded text-sm ${
                            isCorrect
                                ? 'bg-green-100 text-green-800 font-semibold underline'
                                : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                        <NewlineMathText
                            content={word}
                            as="span"
                            className="quiz-text-preserve-inline"
                        />
                        {isCorrect && <span className="ml-1 text-green-600">✓</span>}
                    </span>
                );
            })}
        </div>
    </div>
);

export default React.memo(UnderlineRenderer);
