import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { StudentDetailModal } from '../teacher/ResultsView';
import { fetchResultAnswerReview } from '../../services/results/resultAnswersService';
import { ApiError } from '../../services/api/errors';
import { useQuizStore } from '../../../stores/quizStore';
import { getTeacherRoute } from '../../app/navigationRoutes';
import type { Question, StudentResult } from '../../types';

const TeacherResultDetailPage: React.FC = () => {
    const { resultId = '' } = useParams<{ resultId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const quizStore = useQuizStore();

    const result = useMemo(
        () => quizStore.results.find((item) => String(item.id) === String(resultId)) || null,
        [quizStore.results, resultId],
    );

    const [resolvedResult, setResolvedResult] = useState<StudentResult | null>(result);
    const [isPageLoading, setIsPageLoading] = useState(result === null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const currentResolvedResult = resolvedResult
        && String(resolvedResult.id) === String(resultId)
        ? resolvedResult
        : null;

    const questions = useMemo<Question[]>(() => {
        const detailResult = currentResolvedResult || result;
        if (!detailResult) return [];
        const quiz = quizStore.quizzes.find((q) => q.id === detailResult.quizId);
        return quiz?.questions || [];
    }, [currentResolvedResult, quizStore.quizzes, result]);

    useEffect(() => {
        let cancelled = false;

        const hydrateResult = async () => {
            const hasAnswers = Boolean(result?.answers && Object.keys(result.answers).length > 0);
            const hasReviewDetails = Array.isArray(result?.reviewDetails);
            if (result && hasAnswers && hasReviewDetails) {
                setResolvedResult(result);
                setLoadError(null);
                setIsPageLoading(false);
                return;
            }

            setResolvedResult(result);
            setIsPageLoading(true);
            setLoadError(null);

            try {
                const payload = await fetchResultAnswerReview(result?.id || resultId);
                if (cancelled) return;

                const baseResult = payload?.result || result;
                if (!baseResult) {
                    setResolvedResult(null);
                    setLoadError('Không tìm thấy kết quả này. Có thể dữ liệu đã bị xóa.');
                    return;
                }

                const hydratedAnswers = Object.keys(payload?.answers || {}).length > 0
                    ? payload.answers
                    : baseResult.answers;
                setResolvedResult({
                    ...baseResult,
                    answers: hydratedAnswers,
                    reviewDetails: payload?.reviewDetails || baseResult.reviewDetails || [],
                });
            } catch (error) {
                if (!cancelled) {
                    setResolvedResult(result);
                    if (result) {
                        setLoadError('Không tải được chi tiết câu trả lời. Hiển thị dữ liệu hiện có.');
                    } else if (error instanceof ApiError && error.status === 404) {
                        setLoadError('Không tìm thấy kết quả này. Có thể dữ liệu đã bị xóa.');
                    } else {
                        setLoadError('Không tải được kết quả này. Vui lòng kiểm tra kết nối và thử lại.');
                    }
                }
            } finally {
                if (!cancelled) {
                    setIsPageLoading(false);
                }
            }
        };

        void hydrateResult();

        return () => {
            cancelled = true;
        };
    }, [result, resultId]);

    const handleBack = () => {
        // Back restores result filters/page; direct links replace to the canonical results route.
        if (location.key === 'default') navigate(getTeacherRoute('results'), { replace: true });
        else navigate(-1);
    };

    if (!currentResolvedResult && !isPageLoading) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <button
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                    <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
                </button>
                <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-amber-100 bg-amber-50 p-6 text-amber-700">
                    {loadError || 'Không tìm thấy kết quả này. Có thể dữ liệu đã bị xóa.'}
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

            {currentResolvedResult && (
                <StudentDetailModal
                    embedded
                    result={currentResolvedResult}
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