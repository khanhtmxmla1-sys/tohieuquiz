/**
 * MatchingRenderer.tsx
 * Renders a Matching (nối cột) question in read-only mode.
 */
import React from 'react';
import type { MatchingQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface MatchingRendererProps {
    question: MatchingQuestion;
}

const MatchingRenderer: React.FC<MatchingRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-1">
        {question.pairs.map((pair, i) => (
            <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-sm"
            >
                <NewlineMathText
                    content={pair.left}
                    as="span"
                    className="text-gray-800 font-medium quiz-text-preserve-inline"
                />
                <span className="text-gray-400">→</span>
                <NewlineMathText
                    content={pair.right}
                    as="span"
                    className="text-green-700 font-semibold quiz-text-preserve-inline"
                />
            </div>
        ))}
    </div>
);

export default React.memo(MatchingRenderer);
