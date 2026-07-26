import React from 'react';
import { Clock3 } from 'lucide-react';
import { NewlineMathText } from '../../../components/common';
import type { RecentMathFormula } from './recentMathFormulaRepository';

interface RecentFormulaListProps {
    items: RecentMathFormula[];
    onInsert(item: RecentMathFormula): void;
}

const RecentFormulaList: React.FC<RecentFormulaListProps> = ({ items, onInsert }) => {
    if (items.length === 0) return null;

    return (
        <section className="border-t border-slate-200 pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Clock3 className="h-4 w-4 text-slate-500" /> Công thức vừa dùng
            </h3>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-label={`Chèn lại ${item.label}`}
                        title={`Chèn lại ${item.label}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onInsert(item)}
                        className="min-h-11 shrink-0 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm hover:border-sky-400 hover:bg-sky-50"
                    >
                        <NewlineMathText content={item.preview} />
                    </button>
                ))}
            </div>
        </section>
    );
};

export default RecentFormulaList;
