import React, { useMemo } from 'react';
import { BaseRendererProps } from '../types';
import MathSpan from '../atoms/MathSpan';

const MatchingRenderer: React.FC<BaseRendererProps> = ({
  question: question,
  answers,
  onAnswerChange,
  onMatchingClick,
}) => {
  const currentAnswers = (answers[question.id] as Record<string, any>) || {};
  const selectedLeft = currentAnswers.selectedLeft;

  const currentPairs = useMemo(() => {
    const pairs: Record<string, string> = {};
    Object.entries(currentAnswers).forEach(([key, value]) => {
      if (key !== 'selectedLeft' && key !== '__shuffledIds' && typeof value === 'string') {
        pairs[key] = value;
      }
    });
    return pairs;
  }, [currentAnswers]);

  let rawPairs = (question as any).pairs || [];
  let rawLeftItems = (question as any).leftItems || [];
  let rawRightItems = (question as any).rightItems || [];

  if (rawLeftItems.length === 0 && rawPairs.length === 0 && Array.isArray((question as any).items)) {
    const totalItems = (question as any).items;
    if (totalItems.length > 0 && totalItems[0].left) {
      rawPairs = totalItems;
    } else {
      const half = Math.ceil(totalItems.length / 2);
      rawLeftItems = totalItems.slice(0, half).map((text: any, index: number) => (
        typeof text === 'string' ? { id: `l-${index}`, content: text } : text
      ));
      rawRightItems = totalItems.slice(half).map((text: any, index: number) => (
        typeof text === 'string' ? { id: `r-${index}`, content: text } : text
      ));
    }
  }

  const itemsLeft = useMemo(() => {
    if (rawLeftItems.length > 0) return rawLeftItems;
    if (rawPairs.length > 0) {
      return rawPairs.map((pair: any, index: number) => ({ id: `l-${index}`, content: pair.left }));
    }
    return [];
  }, [rawLeftItems, rawPairs]);

  const itemsRight = useMemo(() => {
    const rawItems = rawRightItems.length > 0
      ? [...rawRightItems]
      : rawPairs.map((pair: any, index: number) => ({ id: `r-${index}`, content: pair.right }));

    const savedOrder = currentAnswers.__shuffledIds;
    if (savedOrder && Array.isArray(savedOrder)) {
      return savedOrder
        .map((id) => rawItems.find((item: any) => item.id === id))
        .filter(Boolean);
    }

    const shuffled = [...rawItems];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }, [rawRightItems, rawPairs, currentAnswers.__shuffledIds]);

  React.useEffect(() => {
    if (!currentAnswers.__shuffledIds && itemsRight.length > 0) {
      const ids = itemsRight.map((item: any) => item.id);
      onAnswerChange(question.id, { ...currentAnswers, __shuffledIds: ids });
    }
  }, [question.id, itemsRight, currentAnswers.__shuffledIds, onAnswerChange]);

  const getPairNumber = (itemId: string, side: 'left' | 'right') => {
    const pairs = Object.entries(currentPairs);
    const pairIndex = pairs.findIndex(([leftId, rightId]) => (
      side === 'left' ? leftId === itemId : rightId === itemId
    ));
    return pairIndex >= 0 ? pairIndex + 1 : null;
  };

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3 md:gap-x-6">
      <div className="space-y-3">
        <h3 className="mb-2 text-center text-xs font-semibold text-slate-500">Cột A</h3>
        {itemsLeft.map((item: any, index: number) => {
          const isSelected = selectedLeft === item.id;
          const pairNumber = getPairNumber(item.id, 'left');
          const isPaired = pairNumber !== null;

          return (
            <button
              key={item.id || index}
              type="button"
              onClick={() => onMatchingClick?.(question.id, item.id, 'left')}
              className={`relative flex min-h-[68px] w-full items-center rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 md:p-4 ${
                isPaired
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                  : isSelected
                    ? 'border-sky-500 bg-sky-50 text-sky-950'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-sky-300'
              }`}
            >
              <span className="flex-1 pr-2 font-medium">
                <MathSpan content={item.content} className="text-sm leading-snug md:text-base" />
              </span>
              {isPaired ? (
                <span className="shrink-0 rounded-[6px] bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  Cặp {pairNumber}
                </span>
              ) : isSelected ? (
                <span className="shrink-0 text-[10px] font-semibold text-sky-700">Đang chọn</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <h3 className="mb-2 text-center text-xs font-semibold text-slate-500">Cột B</h3>
        {itemsRight.map((item: any, index: number) => {
          const pairNumber = getPairNumber(item.id, 'right');
          const isPaired = pairNumber !== null;

          return (
            <button
              key={item.id || index}
              type="button"
              onClick={() => onMatchingClick?.(question.id, item.id, 'right')}
              className={`relative flex min-h-[68px] w-full items-center rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 md:p-4 ${
                isPaired
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-sky-300'
              }`}
            >
              {isPaired ? (
                <span className="mr-2 shrink-0 rounded-[6px] bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  Cặp {pairNumber}
                </span>
              ) : null}
              <span className="flex-1 font-medium">
                <MathSpan content={item.content} className="text-sm leading-snug md:text-base" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(MatchingRenderer);
