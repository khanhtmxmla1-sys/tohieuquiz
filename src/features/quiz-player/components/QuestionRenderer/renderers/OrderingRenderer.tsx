import React, { useMemo } from 'react';
import { RefreshCcw } from 'lucide-react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';
import { orderingItemIdAt, selectedOrderingRanks } from '../utils/answerState';
import { answerInputClasses } from '../../answer-state/stateStyles';
import { updateOrderingRanks } from '../../../utils/structuredAnswerUpdates';

/**
 * Robust helper: extract text from any item format (String, Number, Object).
 */
const extractItemText = (item: any): string => {
    if (!item && item !== 0) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    
    if (typeof item === 'object') {
        const textVal = item.content || item.text || item.sentence || item.label || item.name || item.value;
        if (textVal && typeof textVal === 'string') return textVal;
        if (textVal && typeof textVal === 'object') return extractItemText(textVal);
        
        // Check if it's a character-index object (from spread strings)
        const keys = Object.keys(item);
        if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
            const maxIdx = Math.max(...keys.map(Number));
            let result = '';
            for (let i = 0; i <= maxIdx; i++) {
                result += item[i] || '';
            }
            if (result.trim()) return result;
        }
        return JSON.stringify(item);
    }
    return String(item);
};

/**
 * OrderingRenderer: Renders a question where students assign rank numbers to items.
 */
const OrderingRenderer: React.FC<BaseRendererProps> = ({
    question: q,
    answers,
    onAnswerChange,
}) => {
    const currentRanks = selectedOrderingRanks(q, answers[q.id]);
    const items = (q as any).items || [];
    const duplicateRanks = new Set(
        Object.entries(
            Object.values(currentRanks).reduce<Record<number, number>>((counts, rank) => {
                counts[rank] = (counts[rank] || 0) + 1;
                return counts;
            }, {}),
        )
            .filter(([, count]) => count > 1)
            .map(([rank]) => Number(rank)),
    );

    // Visual Shuffle: Shuffle items for display but keep track of original indices.
    // useMemo and question.id ensure the shuffle stays stable across re-renders.
    const shuffledItems = useMemo(() => {
        const itemsWithIndex = items.map((item: any, idx: number) => ({
            content: extractItemText(item),
            idx
        }));
        
        // Fisher-Yates shuffle
        for (let i = itemsWithIndex.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [itemsWithIndex[i], itemsWithIndex[j]] = [itemsWithIndex[j], itemsWithIndex[i]];
        }
        return itemsWithIndex;
    }, [q.id, items]);

    const handleOrderChange = (originalIndex: number, orderValue: string) => {
        const num = parseInt(orderValue, 10);
        if (orderValue === '' || (!isNaN(num) && num >= 1 && num <= items.length)) {
            const itemId = orderingItemIdAt(originalIndex);
            const ranks = updateOrderingRanks(currentRanks, itemId, orderValue === '' ? null : num);
            onAnswerChange(q.id, { type: 'ORDERING', ranks });
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4">
                <p className="text-sm text-amber-800">
                    📝 <strong>Hướng dẫn:</strong> Điền số thứ tự (1, 2, 3...) vào ô trống để sắp xếp các câu thành đoạn văn hoàn chỉnh.
                </p>
            </div>

            <div className="space-y-3">
                {shuffledItems.map((item) => {
                    const itemId = orderingItemIdAt(item.idx);
                    const rank = currentRanks[itemId];
                    const hasDuplicateRank = duplicateRanks.has(rank);
                    return (
                        <div key={item.idx} className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex-shrink-0">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min="1"
                                    max={items.length}
                                    value={rank || ''}
                                    onChange={(e) => handleOrderChange(item.idx, e.target.value)}
                                    placeholder="?"
                                    aria-label={`Số thứ tự cho ${item.content}`}
                                    aria-invalid={hasDuplicateRank || undefined}
                                    aria-describedby={hasDuplicateRank ? `ordering-error-${q.id}` : undefined}
                                    className={`w-12 h-12 rounded-lg border-2 text-center text-[16px] font-bold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 md:text-xl ${
                                        hasDuplicateRank
                                            ? 'border-red-500 bg-red-50 text-red-900'
                                            : answerInputClasses(Boolean(rank))
                                    }`}
                                />
                            </div>
                            <div className="flex-1 pt-2">
                                <MathSpan content={item.content} className="text-gray-800 font-medium text-lg leading-relaxed" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {duplicateRanks.size > 0 ? (
                <p
                    id={`ordering-error-${q.id}`}
                    role="alert"
                    className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                >
                    Số thứ tự {Array.from(duplicateRanks).sort((left, right) => left - right).join(', ')} đang được dùng cho nhiều mục. Mỗi số chỉ dùng một lần.
                </p>
            ) : null}

            <div className="flex justify-between items-center mt-4">
                <p className="text-xs text-gray-500">
                    Đã điền: {Object.values(currentRanks).filter(v => v !== undefined).length}/{items.length}
                </p>
                <button
                    onClick={() => onAnswerChange(q.id, { type: 'ORDERING', ranks: {} })}
                    className="text-xs text-red-500 hover:underline flex items-center"
                >
                    <RefreshCcw className="w-3 h-3 mr-1" /> Làm lại câu này
                </button>
            </div>
        </div>
    );
};

export default React.memo(OrderingRenderer);
