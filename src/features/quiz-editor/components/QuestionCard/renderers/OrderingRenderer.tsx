/**
 * OrderingRenderer.tsx
 * Renders an Ordering (sắp xếp thứ tự) question in read-only mode.
 */
import React from 'react';
import type { OrderingQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface OrderingRendererProps {
    question: OrderingQuestion;
}

const OrderingRenderer: React.FC<OrderingRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-2">
        <p className="text-sm text-gray-500 mb-1">Thứ tự đúng:</p>
        <div className="space-y-1">
            {question.correctOrder.map((itemIdx, pos) => (
                <div key={pos} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {pos + 1}
                    </span>
                    <NewlineMathText
                        content={question.items[itemIdx] ?? ''}
                        as="span"
                        className="text-sm text-gray-700 quiz-text-preserve-inline"
                    />
                </div>
            ))}
        </div>
    </div>
);

export default React.memo(OrderingRenderer);
