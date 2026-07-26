import React, { useMemo } from 'react';
import { RefreshCcw } from 'lucide-react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';

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
    const currentAnswers = (answers[q.id] as Record<number, number>) || {};
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
            onAnswerChange(q.id, {
                ...currentAnswers,
                [originalIndex]: orderValue === '' ? undefined : num
            });
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
                                value={currentAnswers[item.idx] || ''}
                                onChange={(e) => handleOrderChange(item.idx, e.target.value)}
                                placeholder="?"
                                className="w-12 h-12 text-center text-[16px] md:text-xl font-bold border-2 border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
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
                    Đã điền: {Object.values(currentAnswers).filter(v => v !== undefined).length}/{items.length}
                </p>
                <button
                    onClick={() => onAnswerChange(q.id, {})}
                    className="text-xs text-red-500 hover:underline flex items-center"
                >
                    <RefreshCcw className="w-3 h-3 mr-1" /> Làm lại câu này
                </button>
            </div>
        </div>
    );
};

export default React.memo(OrderingRenderer);
