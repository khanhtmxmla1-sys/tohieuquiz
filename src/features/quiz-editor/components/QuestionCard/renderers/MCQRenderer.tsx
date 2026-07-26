/**
 * MCQRenderer.tsx
 * Renders a Multiple Choice Question (single correct answer) in read-only mode.
 */
import React from 'react';
import type { MCQQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface MCQRendererProps {
    question: MCQQuestion;
}

const MCQRenderer: React.FC<MCQRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-1">
        {question.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const isCorrect = letter === question.correctAnswer;
            // Strip legacy prefixes like "A. ", "a) "
            const cleanOpt = opt.replace(/^[A-Da-d][.)]\s*/, '');
            return (
                <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                        isCorrect
                            ? 'bg-green-100 text-green-800 font-semibold'
                            : 'text-gray-600'
                    }`}
                >
                    <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>
                        {letter}.
                    </span>
                    <NewlineMathText
                        content={cleanOpt}
                        as="span"
                        className="quiz-text-preserve-inline flex-1"
                    />
                    {isCorrect && <span className="ml-auto text-green-600">✓</span>}
                </div>
            );
        })}
    </div>
);

export default React.memo(MCQRenderer);
