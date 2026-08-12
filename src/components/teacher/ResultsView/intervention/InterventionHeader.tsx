import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

interface QuizScopeOption {
  id: string;
  title: string;
}

export interface InterventionHeaderProps {
  classNameFilter: string;
  quizId: string;
  quizzes: QuizScopeOption[];
  windowDays: number;
  isOnline: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

const getClassScopeLabel = (classNameFilter: string): string => {
  const value = classNameFilter.trim();
  if (!value || value.toLowerCase() === 'all') return 'Tất cả lớp';
  return /^lớp\s/i.test(value) ? value : `Lớp ${value}`;
};

const getQuizScopeLabel = (quizId: string, quizzes: QuizScopeOption[]): string => {
  if (!quizId || quizId === 'all') return 'Tất cả bài kiểm tra';
  return quizzes.find((quiz) => quiz.id === quizId)?.title || 'Bài kiểm tra đã chọn';
};

export const InterventionHeader: React.FC<InterventionHeaderProps> = ({
  classNameFilter,
  quizId,
  quizzes,
  windowDays,
  isOnline,
  isLoading,
  onRefresh,
}) => (
  <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Sparkles size={20} className="shrink-0 text-amber-600" aria-hidden="true" />
        <span>Gợi ý hỗ trợ học sinh</span>
      </h3>
      <p className="mt-1 text-sm text-slate-600">Phân tích từ kết quả học tập</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {getClassScopeLabel(classNameFilter)} · {getQuizScopeLabel(quizId, quizzes)} · {windowDays} ngày
      </p>
    </div>
    <button
      type="button"
      onClick={onRefresh}
      disabled={!isOnline || isLoading}
      aria-label="Làm mới gợi ý hỗ trợ học sinh"
      aria-busy={isLoading}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
      <span>Làm mới</span>
    </button>
  </header>
);

export default InterventionHeader;
