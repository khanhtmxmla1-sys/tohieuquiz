import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Question, QuestionType } from '../../types';

interface QuizSidebarProps {
    timeLeft: number;
    questions: Question[];
    answers: Record<string, any>;
    onSubmit: () => void;
    formatTime: (seconds: number) => string;
}

/**
 * Helper function to check if a question is answered
 */
const isQuestionAnswered = (q: Question, answers: Record<string, any>): boolean => {
    if (q.type === QuestionType.TRUE_FALSE) {
        return q.items.every((item: any, idx: number) => {
            const itemKey = item.id || `item-${idx}`;
            return answers[q.id]?.[itemKey] !== undefined;
        });
    } else if (q.type === QuestionType.MATCHING) {
        const userPairs = answers[q.id] || {};
        const pairedCount = Object.keys(userPairs).filter(k => k !== 'selectedLeft').length;
        return pairedCount === q.pairs.length;
    } else if (q.type === QuestionType.MULTIPLE_SELECT) {
        return (answers[q.id] as string[])?.length > 0;
    } else if (q.type === QuestionType.DRAG_DROP) {
        const qAny = q as any;
        const text = qAny.text || "";
        const parts = text.split(/(\[.*?\])/g);
        const blanks: number[] = [];
        parts.forEach((part: string, idx: number) => {
            if (part.startsWith('[') && part.endsWith(']')) {
                blanks.push(idx);
            }
        });
        const currentAnswers = (answers[q.id] as Record<number, string>) || {};
        return blanks.length > 0 && blanks.every(idx => currentAnswers[idx] !== undefined);
    } else {
        return !!answers[q.id];
    }
};

/**
 * Quiz sidebar with timer and question navigation
 */
const QuizSidebar: React.FC<QuizSidebarProps> = ({
    timeLeft,
    questions,
    answers,
    onSubmit,
    formatTime
}) => {
    const answeredCount = questions.filter(q => isQuestionAnswered(q, answers)).length;

    const scrollToQuestion = (index: number) => {
        document.getElementById(`question-${index}`)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="w-full md:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-24">
                {/* Timer */}
                <div className="text-center mb-6">
                    <p className="text-sm text-gray-500 mb-1">Thời gian còn lại</p>
                    <div className="text-3xl font-mono font-bold text-orange-600 bg-orange-50 py-2 rounded-lg border border-orange-100">
                        {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Question Navigation */}
                <div className="mb-6">
                    <p className="text-sm font-bold text-gray-700 mb-3 flex justify-between">
                        <span>Danh sách câu hỏi</span>
                        <span className="text-gray-400 font-normal">{answeredCount}/{questions.length}</span>
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                        {questions.map((q, index) => {
                            const isAnswered = isQuestionAnswered(q, answers);
                            return (
                                <button
                                    key={q.id}
                                    onClick={() => scrollToQuestion(index)}
                                    className={`h-10 w-10 flex items-center justify-center rounded-full text-sm font-bold transition-all ${isAnswered
                                        ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                >
                                    {index + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    onClick={onSubmit}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center"
                >
                    <CheckCircle className="w-5 h-5 mr-2" /> NỘP BÀI
                </button>
            </div>
        </div>
    );
};

export default QuizSidebar;
