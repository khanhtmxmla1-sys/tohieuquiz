import React from 'react';
import { Search, Filter } from 'lucide-react';

export type FilterType = 'all' | 'correct' | 'wrong' | 'skipped';

interface Props {
    filter: FilterType;
    onFilterChange: (filter: FilterType) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    counts: {
        all: number;
        correct: number;
        wrong: number;
        skipped: number;
    };
}

const QuestionFilter: React.FC<Props> = ({
    filter,
    onFilterChange,
    searchQuery,
    onSearchChange,
    counts
}) => {
    const filters: { id: FilterType; label: string; color: string; bgColor: string }[] = [
        { id: 'all', label: 'Tất cả', color: 'text-gray-700', bgColor: 'bg-gray-100 hover:bg-gray-200' },
        { id: 'correct', label: '✅ Đúng', color: 'text-green-700', bgColor: 'bg-green-100 hover:bg-green-200' },
        { id: 'wrong', label: '❌ Sai', color: 'text-red-700', bgColor: 'bg-red-100 hover:bg-red-200' },
        { id: 'skipped', label: '⚪ Bỏ qua', color: 'text-gray-500', bgColor: 'bg-gray-100 hover:bg-gray-200' },
    ];

    return (
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 border-b">
            {/* Search */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Tìm kiếm câu hỏi..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2 overflow-x-auto">
                {filters.map((f) => {
                    const isActive = filter === f.id;
                    const count = counts[f.id];

                    return (
                        <button
                            key={f.id}
                            onClick={() => onFilterChange(f.id)}
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap
                transition-all duration-200
                ${isActive
                                    ? `${f.bgColor} ${f.color} ring-2 ring-offset-1 ring-gray-300`
                                    : `bg-white border border-gray-200 text-gray-600 hover:bg-gray-50`
                                }
              `}
                        >
                            <span>{f.label}</span>
                            <span className={`
                px-2 py-0.5 rounded-full text-xs font-bold
                ${isActive ? 'bg-white/50' : 'bg-gray-100'}
              `}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default QuestionFilter;
