/**
 * DragDropRenderer.tsx
 * Renders a Drag-and-Drop (kéo thả điền chỗ trống) question in read-only mode.
 */
import React from 'react';
import type { DragDropQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface DragDropRendererProps {
    question: DragDropQuestion;
}

const DragDropRenderer: React.FC<DragDropRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-2">
        <NewlineMathText
            content={question.text.replace(/\[([^\]]+)\]/g, '[ ___ ]')}
            as="p"
            className="text-sm text-gray-600 quiz-text-preserve-block"
        />
        <div className="flex flex-wrap gap-1">
            <span className="text-sm text-gray-500 mr-2">Đáp án:</span>
            {question.blanks.map((blank, i) => (
                <span
                    key={i}
                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold"
                >
                    <NewlineMathText content={blank} as="span" className="quiz-text-preserve-inline" />
                </span>
            ))}
        </div>
        {question.distractors.length > 0 && (
            <div className="flex flex-wrap gap-1">
                <span className="text-sm text-gray-500 mr-2">Gây nhiễu:</span>
                {question.distractors.map((d, i) => (
                    <span
                        key={i}
                        className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs"
                    >
                        <NewlineMathText content={d} as="span" className="quiz-text-preserve-inline" />
                    </span>
                ))}
            </div>
        )}
    </div>
);

export default React.memo(DragDropRenderer);
