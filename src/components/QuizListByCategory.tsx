import React from 'react';
import { Lock } from 'lucide-react';
import { QUIZ_CATEGORIES } from '../config/constants';
import { Quiz } from '../types';

interface QuizListByCategoryProps {
    selectedClassLevel: string;
    selectedCategory: string;
    quizzes: Quiz[];
    onSelectQuiz: (quiz: Quiz) => void;
    onBack: () => void;
}

export const QuizListByCategory: React.FC<QuizListByCategoryProps> = ({
    selectedClassLevel,
    selectedCategory,
    quizzes,
    onSelectQuiz,
    onBack
}) => {
    const categoryInfo = QUIZ_CATEGORIES.find(c => c.id === selectedCategory);
    const filteredQuizzes = quizzes.filter(
        q => q.classLevel === selectedClassLevel && q.category === selectedCategory
    );

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">
                        {categoryInfo?.name || 'Bài kiểm tra'}
                    </h3>
                    <p className="text-xs text-gray-500">Lớp {selectedClassLevel}</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-600 transition-all"
                >
                    ← Quay lại
                </button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredQuizzes.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <div className="text-5xl mb-3 text-gray-300">∅</div>
                        <p className="text-gray-400">Chưa có bài kiểm tra nào trong danh mục này.</p>
                    </div>
                ) : (
                    filteredQuizzes.map((q, index) => (
                        <button
                            key={q.id}
                            onClick={() => onSelectQuiz(q)}
                            className="w-full text-left p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-all border border-green-100 hover:border-green-300 group shadow-sm hover:shadow-md"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-green-800 group-hover:text-green-900 flex items-center gap-2">
                                    {q.requireCode && <Lock className="w-4 h-4 text-amber-500" />}
                                    {q.title}
                                </span>
                                <span className="bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1 rounded-full text-xs font-bold text-white shadow group-hover:shadow-md group-hover:scale-105 transition-all">
                                    Bắt đầu →
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>{q.questions.length} câu hỏi</span>
                                <span>{q.timeLimit} phút</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </>
    );
};

export default QuizListByCategory;
