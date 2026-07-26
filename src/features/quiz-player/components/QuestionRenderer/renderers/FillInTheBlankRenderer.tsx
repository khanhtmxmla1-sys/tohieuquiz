import React, { useCallback, useMemo } from 'react';
import { BaseRendererProps } from '../types';
import SmartText from '../utils/SmartText';
import LatexDropdown from '../atoms/LatexDropdown';
import InteractiveMathText, { getInteractiveBlankIds } from '../atoms/InteractiveMathText';

const seededShuffle = <T,>(values: T[], seedText: string): T[] => {
    const output = [...values];
    let seed = 2166136261;
    for (const char of seedText) {
        seed ^= char.charCodeAt(0);
        seed = Math.imul(seed, 16777619);
    }
    const random = () => {
        seed += 0x6D2B79F5;
        let value = seed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = output.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
};

/** Fill/dropdown renderer that keeps interactive blanks outside invalid TeX fragments. */
const FillInTheBlankRenderer: React.FC<BaseRendererProps> = ({
    question: q,
    answers,
    onAnswerChange,
}) => {
    const isDragDrop = q.type === 'DRAG_DROP' || (q as any).mathType === 'drag_drop';
    const text = String((q as any).text || (q as any).content || '');
    const blanksData = (q as any).blanks;
    const distractors = Array.isArray((q as any).distractors) ? (q as any).distractors : [];
    const blankIds = useMemo(() => getInteractiveBlankIds(text), [text]);

    const pool = useMemo(() => {
        if (!isDragDrop) return [];
        const blanks = Array.isArray(blanksData)
            ? blanksData.filter((blank: unknown) => typeof blank === 'string')
            : [];
        return seededShuffle(
            [...blanks, ...distractors].map((value) => String(value)),
            `${q.id}:${JSON.stringify(blanks)}:${JSON.stringify(distractors)}`,
        );
    }, [q.id, isDragDrop, blanksData, distractors]);

    const handleFill = useCallback((blankId: string, value: string) => {
        onAnswerChange(q.id, value, blankId);
    }, [onAnswerChange, q.id]);

    const resolveBlankOptions = useCallback((blankId: string): string[] => {
        let options: unknown[] = [];
        if (Array.isArray(blanksData)) {
            const numericId = Number.parseInt(blankId, 10);
            const found = blanksData.find((blank: any) => blank && typeof blank === 'object' && (
                String(blank.id) === blankId || blank.index === numericId
            ));
            if (found) {
                options = Array.isArray(found.options) ? found.options : [];
            } else if (Number.isFinite(numericId)) {
                const byOneBasedIndex = blanksData[numericId - 1];
                const byZeroBasedIndex = blanksData[numericId];
                const candidate = byOneBasedIndex && typeof byOneBasedIndex === 'object'
                    ? byOneBasedIndex
                    : byZeroBasedIndex;
                options = Array.isArray(candidate?.options) ? candidate.options : [];
            }
        } else if (blanksData && typeof blanksData === 'object') {
            const candidate = blanksData[blankId];
            options = Array.isArray(candidate?.options) ? candidate.options : [];
        }

        if (options.length === 0 && (q as any).options) {
            const fallback = (q as any).options[blankId];
            options = Array.isArray(fallback) ? fallback : [];
        }
        return options.map((value) => String(value));
    }, [blanksData, q]);

    const renderBlank = useCallback((blankId: string, key: React.Key): React.ReactNode => {
        const blankOptions = resolveBlankOptions(blankId);
        const currentValue = String(answers[q.id]?.[blankId] ?? '');

        if (blankOptions.length > 0) {
            return (
                <LatexDropdown
                    key={key}
                    options={blankOptions}
                    value={currentValue}
                    onChange={(value) => handleFill(blankId, value)}
                    placeholder="..."
                    className="mx-1 align-middle"
                />
            );
        }

        return (
            <input
                key={key}
                aria-label={`Ô trống ${blankId}`}
                type="text"
                value={currentValue}
                onChange={(event) => handleFill(blankId, event.target.value)}
                placeholder="..."
                className={`mx-1 inline-block w-20 min-w-[72px] rounded-[8px] border px-2 py-1 text-center align-middle outline-none transition-colors ${
                    isDragDrop
                        ? 'cursor-pointer border-sky-300 bg-sky-50 focus:border-sky-500'
                        : 'border-slate-300 bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100'
                }`}
                onClick={() => isDragDrop && currentValue && handleFill(blankId, '')}
                readOnly={isDragDrop}
            />
        );
    }, [answers, handleFill, isDragDrop, q.id, resolveBlankOptions]);

    return (
        <div className="space-y-6">
            <div className="rounded-[10px] border border-slate-200 bg-white p-5 text-[18px] font-medium leading-relaxed text-slate-800 md:p-7 md:text-xl">
                <InteractiveMathText
                    content={text}
                    renderBlank={renderBlank}
                    className="quiz-interactive-math-text"
                />
            </div>

            {isDragDrop && pool.length > 0 && (
                <div className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50 p-5">
                    <p className="mb-4 text-sm font-semibold text-slate-600">
                        Chọn từ để điền vào chỗ trống
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {pool.map((option, index) => {
                            const currentAnswers = Object.values(answers[q.id] || {}).map(String);
                            const usedCount = currentAnswers.filter((value) => value === option).length;
                            const occurrence = pool.slice(0, index + 1).filter((value) => value === option).length;
                            const isUsed = usedCount >= occurrence;

                            return (
                                <button
                                    key={`${option}-${index}`}
                                    type="button"
                                    onClick={() => {
                                        const firstEmptyId = blankIds.find((id) => !answers[q.id]?.[id]);
                                        if (firstEmptyId !== undefined) handleFill(firstEmptyId, option);
                                    }}
                                    disabled={isUsed}
                                    className={`rounded-[8px] border px-4 py-2 font-medium transition-colors ${
                                        isUsed
                                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                                            : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:bg-sky-50'
                                    }`}
                                >
                                    <SmartText content={option} />
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-4 text-center">
                        <button
                            type="button"
                            onClick={() => onAnswerChange(q.id, {})}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                            Xóa hết đáp án đã chọn
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(FillInTheBlankRenderer);