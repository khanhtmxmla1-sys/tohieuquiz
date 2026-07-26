/**
 * CategorizationRenderer.tsx
 * Renders a Categorization (phân loại) question in read-only mode.
 */
import React from 'react';
import type { CategorizationQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface CategorizationRendererProps {
    question: CategorizationQuestion;
}

const CategorizationRenderer: React.FC<CategorizationRendererProps> = ({ question }) => {
    const unassignedItems = question.items.filter(
        (item) => !item.categoryId || item.categoryId === '',
    );

    return (
        <div className="ml-8 space-y-3">
            {question.instruction && (
                <p className="text-sm text-amber-700 italic bg-amber-50 p-2 rounded">
                    <NewlineMathText
                        content={question.instruction}
                        as="span"
                        className="quiz-text-preserve-inline"
                    />
                </p>
            )}

            {question.categories.map((cat) => {
                const itemsInCat = question.items.filter((item) => item.categoryId === cat.id);
                return (
                    <div key={cat.id} className="border rounded-lg p-3 bg-gray-50">
                        <p className="font-bold text-indigo-700 text-sm mb-2">
                            <NewlineMathText
                                content={cat.name}
                                as="span"
                                className="quiz-text-preserve-inline"
                            />
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {itemsInCat.length === 0 ? (
                                <span className="text-gray-400 text-xs italic">
                                    Không có mục nào
                                </span>
                            ) : (
                                itemsInCat.map((item) => (
                                    <span
                                        key={item.id}
                                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"
                                    >
                                        <NewlineMathText
                                            content={item.content}
                                            as="span"
                                            className="quiz-text-preserve-inline"
                                        />
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Unassigned items (broken data safety) */}
            {unassignedItems.length > 0 && (
                <div className="border border-dashed rounded-lg p-3 bg-gray-100">
                    <p className="font-bold text-gray-500 text-sm mb-2">Không thuộc nhóm nào:</p>
                    <div className="flex flex-wrap gap-2">
                        {unassignedItems.map((item) => (
                            <span
                                key={item.id}
                                className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-medium"
                            >
                                <NewlineMathText
                                    content={item.content}
                                    as="span"
                                    className="quiz-text-preserve-inline"
                                />
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(CategorizationRenderer);
