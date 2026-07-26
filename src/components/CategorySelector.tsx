import React from 'react';
import { QUIZ_CATEGORIES } from '../config/constants';
import { Quiz } from '../types';

interface CategorySelectorProps {
    selectedClassLevel: string;
    quizzes: Quiz[];
    onSelectCategory: (categoryId: string) => void;
    onBack: () => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
    selectedClassLevel,
    quizzes,
    onSelectCategory,
    onBack
}) => {
    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Chọn danh mục - Lớp {selectedClassLevel}</h3>
                <button
                    onClick={onBack}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-600 transition-all"
                >
                    ← Quay lại
                </button>
            </div>
            <div className="space-y-3">
                {QUIZ_CATEGORIES.map((cat) => {
                    const quizCount = quizzes.filter(
                        q => q.classLevel === selectedClassLevel && q.category === cat.id
                    ).length;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => onSelectCategory(cat.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r ${cat.color} hover:opacity-90 transition-all group shadow-md hover:shadow-lg`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="text-left">
                                    <p className="font-bold text-white">{cat.name}</p>
                                    <p className="text-xs text-white/80">{quizCount} bài kiểm tra</p>
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-all">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </button>
                    );
                })}
            </div>
        </>
    );
};

export default CategorySelector;
