import React, { useMemo } from 'react';
import { RefreshCcw } from 'lucide-react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';
import { orderingItemIdAt, selectedOrderingRanks } from '../utils/answerState';
import { answerInputClasses } from '../../answer-state/stateStyles';

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
            const ranks = { ...currentRanks };
            if (orderValue === '') delete ranks[itemId];
            else ranks[itemId] = num;
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
                {shuffledItems.map((item) => (
                    <div key={item.idx} className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex-shrink-0">
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min="1"
                                max={items.length}
                                value={currentRanks[orderingItemIdAt(item.idx)] || ''}
                                onChange={(e) => handleOrderChange(item.idx, e.target.value)}
                                placeholder="?"
                                className={`w-12 h-12 rounded-lg border-2 text-center text-[16px] font-bold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 md:text-xl ${answerInputClasses(Boolean(currentRanks[orderingItemIdAt(item.idx)]))}`}
                            />
                        </div>
                        <div className="flex-1 pt-2">
                            <MathSpan content={item.content} className="text-gray-800 font-medium text-lg leading-relaxed" />
                        </div>
                    </div>
                ))}
            </div>

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
