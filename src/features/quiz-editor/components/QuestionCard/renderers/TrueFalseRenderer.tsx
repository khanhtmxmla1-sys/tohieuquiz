/**
 * TrueFalseRenderer.tsx
 * Renders a True/False (Đúng/Sai) question in read-only mode.
 */
import React from 'react';
import type { TrueFalseQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';
import { toBoolean, normalizeTrueFalseItems } from '../../../';

interface TrueFalseRendererProps {
    question: TrueFalseQuestion;
}

const TrueFalseRenderer: React.FC<TrueFalseRendererProps> = ({ question }) => {
    // Normalize in case legacy field names are present in serialized data
    const normalizedItems = normalizeTrueFalseItems(question.items);

    return (
        <div className="ml-8 space-y-1">
            {normalizedItems.map((item, i) => (
                <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg text-sm"
                >
                    <span className="text-gray-700">
                        {String.fromCharCode(97 + i)}.{' '}
                        <NewlineMathText
                            content={item.statement}
                            as="span"
                            className="quiz-text-preserve-inline"
                        />
                    </span>
                    <span
                        className={`font-bold px-2 py-0.5 rounded ${
                            toBoolean(item.isCorrect)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                        }`}
                    >
                        {toBoolean(item.isCorrect) ? 'Đ' : 'S'}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default React.memo(TrueFalseRenderer);
