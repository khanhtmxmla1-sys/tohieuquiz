import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { StudentDetailModal } from '../teacher/ResultsView';
import { fetchResultAnswers } from '../../services/results/resultAnswersService';
import { useQuizStore } from '../../../stores/quizStore';
import { useTeacherDashboardUIStore } from '../../stores/useTeacherDashboardUIStore';
import type { Question, StudentResult } from '../../types';

const TeacherResultDetailPage: React.FC = () => {
    const { resultId = '' } = useParams<{ resultId: string }>();
    const navigate = useNavigate();
    const quizStore = useQuizStore();
    const setActiveTab = useTeacherDashboardUIStore((state) => state.setActiveTab);

    const [resolvedResult, setResolvedResult] = useState<StudentResult | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const result = useMemo(
        () => quizStore.results.find((item) => String(item.id) === String(resultId)) || null,
        [quizStore.results, resultId],
    );

    const questions = useMemo<Question[]>(() => {
        if (!result) return [];
        const quiz = quizStore.quizzes.find((q) => q.id === result.quizId);
        return quiz?.questions || [];
    }, [quizStore.quizzes, result]);

    useEffect(() => {
        setActiveTab('results');
    }, [setActiveTab]);

    useEffect(() => {
        let cancelled = false;

        const hydrateResult = async () => {
            if (!result) {
                setResolvedResult(null);
                return;
            }

            if (result.answers && Object.keys(result.answers).length > 0) {
                setResolvedResult(result);
                return;
            }

            setIsPageLoading(true);
            setLoadError(null);

            try {
                const answers = await fetchResultAnswers(result.id);
                if (!cancelled) {
                    setResolvedResult({ ...result, answers });
                }
            } catch {
                if (!cancelled) {
                    setResolvedResult(result);
                    setLoadError('Không tải được chi tiết câu trả lời. Hiển thị dữ liệu hiện có.');
                }
            } finally {
                if (!cancelled) {
                    setIsPageLoading(false);
                }
            }
        };

        hydrateResult();

        return () => {
            cancelled = true;
        };
    }, [result]);

    const handleBack = () => {
        quizStore.setView('teacher_dash');
        setActiveTab('results');
        navigate('/');
    };

    if (!result) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <button
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                    <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
                </button>
                <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-amber-100 bg-amber-50 p-6 text-amber-700">
                    Không tìm thấy kết quả này. Có thể dữ liệu đã bị xóa hoặc chưa được tải.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-8">
                <button
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                    <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
                </button>
            </div>

            {loadError && (
                <div className="mx-auto mt-4 max-w-6xl rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {loadError}
                </div>
            )}

            {resolvedResult && (
                <StudentDetailModal
                    embedded
                    result={resolvedResult}
                    questions={questions}
                    onClose={handleBack}
                />
            )}

            {isPageLoading && (
                <div className="mx-auto max-w-6xl px-4 py-6 text-sm font-medium text-slate-500 md:px-8">
                    Đang tải chi tiết bài làm...
                </div>
            )}
        </div>
    );
};

export default TeacherResultDetailPage;