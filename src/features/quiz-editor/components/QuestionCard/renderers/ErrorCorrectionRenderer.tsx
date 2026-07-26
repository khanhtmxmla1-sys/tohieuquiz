/**
 * ErrorCorrectionRenderer.tsx
 * Renders an Error Correction (tìm từ sai) question in read-only mode.
 */
import React from 'react';
import type { ErrorCorrectionQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface ErrorCorrectionRendererProps {
    question: ErrorCorrectionQuestion;
}

const ErrorCorrectionRenderer: React.FC<ErrorCorrectionRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-2">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <NewlineMathText
                content={question.passage}
                as="p"
                className="text-sm text-blue-900 quiz-text-preserve-block"
            />
        </div>
        <div className="flex gap-4 text-sm">
            <p>
                <span className="text-gray-500">Từ sai:</span>
                <NewlineMathText
                    content={question.wrongWord}
                    as="span"
                    className="font-bold text-red-600 ml-1 quiz-text-preserve-inline"
                />
            </p>
            <p>
                <span className="text-gray-500">Sửa lại:</span>
                <NewlineMathText
                    content={question.correctWord}
                    as="span"
                    className="font-bold text-green-700 ml-1 quiz-text-preserve-inline"
                />
            </p>
        </div>
    </div>
);

export default React.memo(ErrorCorrectionRenderer);
