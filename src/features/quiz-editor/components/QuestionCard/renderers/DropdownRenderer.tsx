/**
 * DropdownRenderer.tsx
 * Renders a Dropdown (điền vào chỗ trống bằng dropdown) question in read-only mode.
 *
 * Text format: "The sky is [1] and the grass is [2]."
 * Each [N] placeholder is replaced with a dropdown badge showing the correct answer.
 */
import React from 'react';
import type { DropdownQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface DropdownRendererProps {
    question: DropdownQuestion;
}

const DropdownRenderer: React.FC<DropdownRendererProps> = ({ question }) => {
    const segments = question.text.split(/(\[\d+\])/g);

    return (
        <div className="ml-8 space-y-2">
            {question.image && (
                <img
                    src={question.image}
                    alt="Question"
                    className="max-h-48 rounded-lg object-contain border"
                />
            )}
            <div className="text-sm text-gray-700 leading-relaxed quiz-text-preserve-block">
                {segments.map((part, idx) => {
                    const match = part.match(/\[(\d+)\]/);
                    if (match) {
                        const blankIndex = parseInt(match[1], 10) - 1;
                        const blank = question.blanks[blankIndex];
                        if (blank) {
                            const optionsList = Array.isArray(blank.options)
                                ? blank.options
                                : [];
                            return (
                                <span
                                    key={idx}
                                    className="inline-flex items-center mx-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 text-xs font-bold"
                                    title={`Options: ${optionsList.join(', ')}`}
                                >
                                    <span aria-hidden="true">▼</span>
                                    <NewlineMathText
                                        content={blank.correctAnswer}
                                        as="span"
                                        className="quiz-text-preserve-inline"
                                    />
                                </span>
                            );
                        }
                    }
                    return (
                        <NewlineMathText
                            key={idx}
                            content={part}
                            as="span"
                            className="quiz-text-preserve-inline"
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(DropdownRenderer);
