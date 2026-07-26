import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Stethoscope, BookOpen, CheckCircle2, XCircle, Sparkles, ArrowRight } from 'lucide-react';
import { callApi } from '../../../services/apiAdapter';
import { motion, AnimatePresence } from 'framer-motion';
import MathSpan from '../../common/MathSpan';
import ExplanationContent from '../../common/ExplanationContent';

// Fluent Emoji CDN
const FLUENT_CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

interface PracticeQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
}

interface DiagnosisData {
    diagnosis: string;
    explanation: string;
    practiceQuestions: PracticeQuestion[];
    wrongQuestionIds: string[];
}

interface DrOwlModalProps {
    isOpen: boolean;
    onClose: () => void;
    quizId: string;
    wrongQuestionIds: string[];
    studentUsername?: string;
    onRewardCoins?: (coins: number) => void;
}

type ModalStep = 'loading' | 'diagnosis' | 'practice' | 'result';

const DrOwlModal: React.FC<DrOwlModalProps> = ({
    isOpen, onClose, quizId, wrongQuestionIds, studentUsername, onRewardCoins
}) => {
    const [step, setStep] = useState<ModalStep>('loading');
    const [data, setData] = useState<DiagnosisData | null>(null);
    const [error, setError] = useState<string>('');
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answeredQuestions, setAnsweredQuestions] = useState<Record<number, { answer: string; correct: boolean }>>({});
    const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);

    // Call AI Tutor API when modal opens
    const fetchDiagnosis = useCallback(async () => {
        setStep('loading');
        setError('');
        setData(null);
        setCurrentQIndex(0);
        setSelectedAnswer(null);
        setAnsweredQuestions({});
        setShowAnswerFeedback(false);

        try {
            const res = await callApi<any>('ai_tutor_diagnose', {
                quizId,
                wrongQuestionIds: wrongQuestionIds.slice(0, 3),
            });

            if (res?.status === 'success' && res.data) {
                setData(res.data);
                setStep('diagnosis');
            } else {
                setError(res?.message || 'Bác sĩ Cú tạm thời bận. Thử lại sau nhé!');
                setStep('diagnosis');
            }
        } catch (err: unknown) {
            console.error('[DrOwl] API error:', err);
            setError('Không kết nối được với Bác sĩ Cú. Kiểm tra lại mạng nhé!');
            setStep('diagnosis');
        }
    }, [quizId, wrongQuestionIds]);

    useEffect(() => {
        if (isOpen) {
            fetchDiagnosis();
        }
    }, [isOpen, fetchDiagnosis]);

    // Handle answer selection in practice mode
    const handleSelectAnswer = (answer: string) => {
        if (showAnswerFeedback) return; // Prevent double-click
        setSelectedAnswer(answer);
        setShowAnswerFeedback(true);

        const currentQ = data?.practiceQuestions[currentQIndex];
        const isCorrect = answer === currentQ?.correctAnswer;

        setAnsweredQuestions(prev => ({
            ...prev,
            [currentQIndex]: { answer, correct: isCorrect }
        }));

        // Auto-advance after 1.5s
        setTimeout(() => {
            setShowAnswerFeedback(false);
            setSelectedAnswer(null);
            if (currentQIndex < (data?.practiceQuestions.length || 0) - 1) {
                setCurrentQIndex(prev => prev + 1);
            } else {
                setStep('result');
                // Reward coins if all correct
                const totalCorrect = Object.values({ ...answeredQuestions, [currentQIndex]: { answer, correct: isCorrect } })
                    .filter(a => a.correct).length;
                if (totalCorrect === data?.practiceQuestions.length && onRewardCoins) {
                    onRewardCoins(50);
                }
            }
        }, 1500);
    };

    if (!isOpen) return null;

    const correctCount = Object.values(answeredQuestions).filter(a => a.correct).length;
    const totalQuestions = data?.practiceQuestions?.length || 3;
    const allCorrect = correctCount === totalQuestions;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 p-5 text-white relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full" />
                    <div className="flex items-center gap-3 relative z-10">
                        <img
                            src={`${FLUENT_CDN}/Owl/3D/owl_3d.png`}
                            alt="Dr. Owl"
                            className="w-14 h-14 drop-shadow-lg"
                        />
                        <div>
                            <h2 className="text-xl font-black">Bác sĩ Cú Mèo</h2>
                            <p className="text-amber-100 text-sm font-medium">
                                {step === 'loading' ? 'Đang đọc bài làm...' :
                                    step === 'diagnosis' ? 'Chẩn đoán xong rồi!' :
                                        step === 'practice' ? `Câu ${currentQIndex + 1}/${totalQuestions}` :
                                            allCorrect ? 'Tuyệt vời! 🎉' : 'Cố gắng thêm nhé!'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors z-10"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    <AnimatePresence mode="wait">

                        {/* LOADING STEP */}
                        {step === 'loading' && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center py-12 gap-6"
                            >
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                >
                                    <Stethoscope className="w-16 h-16 text-amber-500" />
                                </motion.div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-slate-700">Bác sĩ Cú đang khám bài...</p>
                                    <p className="text-sm text-slate-400 mt-1">Đợi tí nhé, khoảng 5 giây thôi! 🦉</p>
                                </div>
                                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                            </motion.div>
                        )}

                        {/* DIAGNOSIS STEP */}
                        {step === 'diagnosis' && (
                            <motion.div
                                key="diagnosis"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                {error ? (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-sm">
                                        <p className="font-bold mb-1">😿 Ôi!</p>
                                        <p>{error}</p>
                                        <button
                                            onClick={fetchDiagnosis}
                                            className="mt-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                                        >
                                            Thử lại
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Diagnosis */}
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Stethoscope className="w-5 h-5 text-amber-600" />
                                                <span className="font-bold text-amber-800 text-sm">Chẩn đoán</span>
                                            </div>
                                            <MathSpan
                                                content={data?.diagnosis}
                                                as="p"
                                                className="text-slate-700 text-sm leading-relaxed"
                                            />
                                        </div>

                                        {/* Explanation */}
                                        {data?.explanation && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <BookOpen className="w-5 h-5 text-blue-600" />
                                                    <span className="font-bold text-blue-800 text-sm">Bác sĩ giảng lại</span>
                                                </div>
                                                <ExplanationContent
                                                    content={data.explanation}
                                                    className="text-slate-700 text-sm leading-relaxed"
                                                />
                                            </div>
                                        )}

                                        {/* CTA Button */}
                                        {data?.practiceQuestions && data.practiceQuestions.length > 0 && (
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setStep('practice')}
                                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-3 text-lg transition-colors"
                                            >
                                                <Sparkles className="w-5 h-5" />
                                                Uống thuốc ngay! ({data.practiceQuestions.length} câu)
                                                <ArrowRight className="w-5 h-5" />
                                            </motion.button>
                                        )}
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* PRACTICE STEP */}
                        {step === 'practice' && data?.practiceQuestions && (
                            <motion.div
                                key={`practice-${currentQIndex}`}
                                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                                className="space-y-4"
                            >
                                {/* Progress bar */}
                                <div className="flex gap-1.5">
                                    {data.practiceQuestions.map((_, i) => (
                                        <div
                                            key={i}
                                            className={`h-2 flex-1 rounded-full transition-colors ${i < currentQIndex ? (answeredQuestions[i]?.correct ? 'bg-emerald-400' : 'bg-red-400') :
                                                i === currentQIndex ? 'bg-amber-400' : 'bg-slate-200'
                                                }`}
                                        />
                                    ))}
                                </div>

                                {/* Question */}
                                <div className="bg-slate-50 rounded-2xl p-4">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">
                                        💊 Viên thuốc {currentQIndex + 1}/{totalQuestions}
                                    </p>
                                    <MathSpan
                                        content={data.practiceQuestions[currentQIndex]?.question}
                                        as="p"
                                        className="text-base font-semibold text-slate-800 leading-relaxed"
                                    />
                                </div>

                                {/* Options */}
                                <div className="space-y-2.5">
                                    {data.practiceQuestions[currentQIndex]?.options.map((opt, i) => {
                                        const isSelected = selectedAnswer === opt;
                                        const isCorrectAnswer = opt === data.practiceQuestions[currentQIndex]?.correctAnswer;
                                        const showResult = showAnswerFeedback;

                                        let btnClass = 'bg-white border-2 border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-amber-950';
                                        if (showResult && isCorrectAnswer) {
                                            btnClass = 'bg-emerald-50 border-2 border-emerald-400 text-emerald-700';
                                        } else if (showResult && isSelected && !isCorrectAnswer) {
                                            btnClass = 'bg-red-50 border-2 border-red-400 text-red-700';
                                        } else if (isSelected) {
                                            btnClass = 'bg-amber-50 border-2 border-amber-400 text-amber-700';
                                        }

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => handleSelectAnswer(opt)}
                                                disabled={showAnswerFeedback}
                                                className={`w-full text-left p-4 rounded-2xl font-semibold text-sm transition-all flex items-center gap-3 ${btnClass}`}
                                            >
                                                <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                    {String.fromCharCode(65 + i)}
                                                </span>
                                                <MathSpan content={opt} className="flex-1" />
                                                {showResult && isCorrectAnswer && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                                                {showResult && isSelected && !isCorrectAnswer && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* RESULT STEP */}
                        {step === 'result' && (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col items-center py-6 gap-5"
                            >
                                {allCorrect ? (
                                    <>
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200 }}
                                        >
                                            <img
                                                src={`${FLUENT_CDN}/Party%20popper/3D/party_popper_3d.png`}
                                                alt="Party"
                                                className="w-24 h-24"
                                            />
                                        </motion.div>
                                        <h3 className="text-2xl font-black text-emerald-600">Khỏi bệnh rồi! 🎉</h3>
                                        <p className="text-slate-600 text-center font-medium">
                                            Tuyệt vời! Em đã trả lời đúng hết {totalQuestions}/{totalQuestions} câu.
                                            <br />Bác sĩ Cú rất tự hào về em! 🦉
                                        </p>
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl py-3 px-6 flex items-center gap-3">
                                            <span className="text-2xl">🪙</span>
                                            <span className="text-amber-700 font-black text-lg">+50 Vàng</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200 }}
                                        >
                                            <img
                                                src={`${FLUENT_CDN}/Seedling/3D/seedling_3d.png`}
                                                alt="Seedling"
                                                className="w-24 h-24"
                                            />
                                        </motion.div>
                                        <h3 className="text-2xl font-black text-blue-600">Đang tiến bộ!</h3>
                                        <p className="text-slate-600 text-center font-medium">
                                            Em đúng {correctCount}/{totalQuestions} câu.
                                            <br />Không sao, ngày mai mình luyện tiếp nhé! 💪
                                        </p>
                                    </>
                                )}

                                <button
                                    onClick={onClose}
                                    className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-8 rounded-2xl transition-colors"
                                >
                                    Đóng
                                </button>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default DrOwlModal;
