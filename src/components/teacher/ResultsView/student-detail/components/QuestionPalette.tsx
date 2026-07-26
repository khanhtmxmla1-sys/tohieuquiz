import React from 'react';
import { AlertCircle, Filter } from 'lucide-react';
import {
    getQuestionTypeLabel,
    type DisplayQuestion,
    type QuestionFilterMode,
} from '../models/questionModel';

interface QuestionPaletteProps {
    hasAnyData: boolean;
    displayQuestions: DisplayQuestion[];
    filteredQuestions: DisplayQuestion[];
    correctCount: number;
    wrongCount: number;
    filterMode: QuestionFilterMode;
    selectedQuestionIndex: number;
    onFilterModeChange: (mode: QuestionFilterMode) => void;
    onQuestionSelect: (index: number) => void;
}

export const QuestionPalette: React.FC<QuestionPaletteProps> = (props) => (
    <div className="lg:w-[28%] xl:w-[25%] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto bg-white custom-scrollbar">
        {!props.hasAnyData ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-8 h-8 text-yellow-500 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Đề thi đã bị xóa</p>
            </div>
        ) : (
            <div className="space-y-4 p-4 md:p-5">
                <div>
                    <div className="flex items-center gap-2 text-slate-800">
                        <Filter className="w-4 h-4 text-blue-500" />
                        <h3 className="text-sm font-black uppercase tracking-wide">Danh sách câu hỏi</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Chọn ô để xem chi tiết, rê chuột để xem loại câu và thời gian.</p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-4">
                    {[
                        { id: 'all' as const, label: 'Tất cả', count: props.displayQuestions.length },
                        { id: 'correct' as const, label: 'Đúng', count: props.correctCount },
                        { id: 'wrong' as const, label: 'Sai', count: props.wrongCount },
                    ].map((filter) => (
                        <button
                            key={filter.id}
                            onClick={() => props.onFilterModeChange(filter.id)}
                            className={`rounded-2xl border px-3 py-2 text-left transition-all ${
                                props.filterMode === filter.id
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <span className="block text-[10px] font-black uppercase tracking-wider">{filter.label}</span>
                            <span className="block text-lg font-black leading-none">{filter.count}</span>
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 lg:grid-cols-5 xl:grid-cols-6">
                    {props.filteredQuestions.map((item, index) => {
                        const statusClass = item.isCorrect === true
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-100 hover:bg-emerald-600'
                            : item.isCorrect === false
                                ? 'bg-rose-500 text-white border-rose-500 shadow-rose-100 hover:bg-rose-600'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200';
                        return (
                            <button
                                key={item.id}
                                onClick={() => props.onQuestionSelect(index)}
                                title={`Câu ${item.index + 1} - ${getQuestionTypeLabel(item.type)}${item.timeSpent ? ` - ${item.timeSpent}s` : ''}`}
                                className={`relative flex aspect-square items-center justify-center rounded-2xl border text-sm font-black shadow-sm transition-all hover:-translate-y-0.5 ${statusClass} ${
                                    index === props.selectedQuestionIndex ? 'ring-4 ring-blue-200 ring-offset-2 scale-105 z-10' : ''
                                }`}
                            >
                                {item.index + 1}
                                <span className="absolute bottom-1 right-1 rounded bg-black/10 px-1 text-[8px] font-black uppercase leading-3">
                                    {getQuestionTypeLabel(item.type)}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Đúng</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Sai</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-200" /> Bỏ qua</span>
                </div>
            </div>
        )}
    </div>
);
