/**
 * Explanation Modal Component
 * 
 * Shows AI-generated explanation for wrong answers
 * and suggests similar practice questions.
 */

import React, { useState, useEffect } from 'react';
import { X, Lightbulb, BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { Question } from '../types';
import { explainAnswer, suggestSimilarQuestions, ExplanationResult, SimilarQuestion } from '../services/aiTutorService';
import { Button, MathSpan, ExplanationContent } from './common';

interface ExplanationModalProps {
    isOpen: boolean;
    onClose: () => void;
    question: Question;
    userAnswer: string;
    correctAnswer: string;
}

const ExplanationModal: React.FC<ExplanationModalProps> = ({
    isOpen,
    onClose,
    question,
    userAnswer,
    correctAnswer,
}) => {
    const [explanation, setExplanation] = useState<ExplanationResult | null>(null);
    const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
    const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
    const [showSimilar, setShowSimilar] = useState(false);
    const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
    const [showPracticeResults, setShowPracticeResults] = useState<Record<number, boolean>>({});

    // Fetch explanation when modal opens
    useEffect(() => {
        if (isOpen && !explanation) {
            fetchExplanation();
        }
    }, [isOpen]);

    const fetchExplanation = async () => {
        setIsLoadingExplanation(true);
        try {
            const result = await explainAnswer(question, userAnswer, correctAnswer);
            setExplanation(result);
        } catch (error) {
            console.error('Error fetching explanation:', error);
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const fetchSimilarQuestions = async () => {
        setIsLoadingSimilar(true);
        setShowSimilar(true);
        try {
            const questions = await suggestSimilarQuestions(question, 2);
            setSimilarQuestions(questions);
        } catch (error) {
            console.error('Error fetching similar questions:', error);
        } finally {
            setIsLoadingSimilar(false);
        }
    };

    const handlePracticeAnswer = (index: number, answer: string) => {
        setPracticeAnswers(prev => ({ ...prev, [index]: answer }));
    };

    const checkPracticeAnswer = (index: number) => {
        setShowPracticeResults(prev => ({ ...prev, [index]: true }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        <h2 className="text-xl font-bold">Gia sư AI giải thích</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Original Question */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-700 mb-2">📝 Câu hỏi:</h3>
                        <div className="text-gray-800">
                            <MathSpan content={(question as any).question || (question as any).mainQuestion || ''} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm inline-flex items-center gap-1">
                                ❌ Bạn chọn: <MathSpan content={userAnswer || '(Trống)'} />
                            </span>
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm inline-flex items-center gap-1">
                                ✅ Đáp án đúng: <MathSpan content={correctAnswer || 'Xem giải thích'} />
                            </span>
                        </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="bg-indigo-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-5 h-5 text-blue-700" />
                            <h3 className="font-semibold text-blue-800">Giải thích:</h3>
                        </div>

                        {isLoadingExplanation ? (
                            <div className="flex items-center gap-2 text-blue-700">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Đang phân tích câu hỏi...</span>
                            </div>
                        ) : explanation?.error ? (
                            <div className="text-red-600">
                                <p>{explanation.error}</p>
                                <Button
                                    onClick={fetchExplanation}
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2"
                                    icon={<RefreshCw className="w-4 h-4" />}
                                >
                                    Thử lại
                                </Button>
                            </div>
                        ) : (
                            <>
                                <ExplanationContent content={explanation?.explanation || ''} />
                                {explanation?.tip && (
                                    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                        <div className="text-yellow-800">
                                            <span className="font-semibold">💡 Mẹo nhớ:</span> <MathSpan content={explanation.tip} />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Similar Questions Section */}
                    {!showSimilar ? (
                        <Button
                            onClick={fetchSimilarQuestions}
                            variant="secondary"
                            className="w-full"
                            icon={<BookOpen className="w-4 h-4" />}
                        >
                            📚 Xem câu hỏi tương tự để luyện tập
                        </Button>
                    ) : (
                        <div className="bg-purple-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <BookOpen className="w-5 h-5 text-blue-700" />
                                <h3 className="font-semibold text-blue-800">Câu hỏi tương tự:</h3>
                            </div>

                            {isLoadingSimilar ? (
                                <div className="flex items-center gap-2 text-blue-700">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Đang tạo câu hỏi luyện tập...</span>
                                </div>
                            ) : similarQuestions.length === 0 ? (
                                <p className="text-gray-500">Không thể tạo câu hỏi tương tự.</p>
                            ) : (
                                <div className="space-y-4">
                                    {similarQuestions.map((sq, index) => (
                                        <div key={sq.question || `sq-${index}`} className="bg-white rounded-lg p-4 border border-purple-200">
                                            <div className="font-medium text-gray-800 mb-3">
                                                {index + 1}. <MathSpan content={sq.question} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                {sq.options?.map((opt, optIndex) => {
                                                    const letter = String.fromCharCode(65 + optIndex);
                                                    const isSelected = practiceAnswers[index] === letter;
                                                    const isCorrect = showPracticeResults[index] && letter === sq.correctAnswer;
                                                    const isWrong = showPracticeResults[index] && isSelected && letter !== sq.correctAnswer;

                                                    return (
                                                        <button
                                                            key={optIndex}
                                                            onClick={() => !showPracticeResults[index] && handlePracticeAnswer(index, letter)}
                                                            disabled={showPracticeResults[index]}
                                                            className={`p-2 rounded-lg text-left text-sm transition-all ${isCorrect ? 'bg-green-100 border-green-500 text-green-700' :
                                                                isWrong ? 'bg-red-100 border-red-500 text-red-700' :
                                                                    isSelected ? 'bg-purple-100 border-purple-500' :
                                                                        'bg-gray-50 hover:bg-purple-50 border-gray-200'
                                                                } border`}
                                                        >
                                                            <span className="font-medium mr-1">{letter}.</span> <MathSpan content={opt} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {practiceAnswers[index] && !showPracticeResults[index] && (
                                                <Button
                                                    onClick={() => checkPracticeAnswer(index)}
                                                    size="sm"
                                                    variant="primary"
                                                >
                                                    Kiểm tra
                                                </Button>
                                            )}
                                            {showPracticeResults[index] && (
                                                <div className={`mt-2 p-2 rounded text-sm ${practiceAnswers[index] === sq.correctAnswer
                                                    ? 'bg-green-50 text-green-700'
                                                    : 'bg-orange-50 text-orange-700'
                                                    }`}>
                                                    {practiceAnswers[index] === sq.correctAnswer
                                                        ? '🎉 Chính xác!'
                                                        : <><span className="font-bold">💡 Giải thích:</span> <MathSpan content={sq.explanation} /></>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t">
                    <Button onClick={onClose} variant="secondary" className="w-full">
                        Đóng
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ExplanationModal;
