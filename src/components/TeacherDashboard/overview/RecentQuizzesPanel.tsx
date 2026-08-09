import { formatSystemDate } from '../../../utils/dateTime';
import React from 'react';
import { ArrowRight, Clock3, Files, ListChecks } from 'lucide-react';
import type { Quiz } from '../../../types';

interface RecentQuizzesPanelProps {
  quizzes: Quiz[];
  onManageQuizzes: () => void;
  onOpenQuiz: (quizId: string) => void;
}

const formatQuizDate = (value: string): string => formatSystemDate(value, 'Chưa cập nhật');

const RecentQuizzesPanel: React.FC<RecentQuizzesPanelProps> = ({ quizzes, onManageQuizzes, onOpenQuiz }) => (
  <section
    aria-labelledby="recent-quizzes-heading"
    className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--dashboard-card-shadow)]"
  >
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-blue-700">Nội dung giảng dạy</p>
        <h2 id="recent-quizzes-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-900">
          Đề kiểm tra gần đây
        </h2>
      </div>
      <button
        type="button"
        onClick={onManageQuizzes}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Xem tất cả
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </div>

    {quizzes.length > 0 ? (
      <div className="divide-y divide-slate-200">
        {quizzes.map((quiz) => (
          <article key={quiz.id} className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:px-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
              <Files aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{quiz.title}</h3>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{quiz.classLevel ? `Lớp ${quiz.classLevel}` : 'Chưa chọn lớp'}</span>
                <span className="inline-flex items-center gap-1">
                  <ListChecks aria-hidden="true" className="size-3.5" />
                  {quiz.questions?.length || 0} câu
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {quiz.timeLimit || 0} phút
                </span>
                <span>{formatQuizDate(quiz.createdAt)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenQuiz(quiz.id)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 self-end rounded-lg px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:self-auto"
            >
              Mở đề
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </button>
          </article>
        ))}
      </div>
    ) : (
      <div className="px-5 py-12 text-center">
        <Files aria-hidden="true" className="mx-auto size-9 text-slate-400" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Chưa có đề kiểm tra</h3>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">
          Khu vực tạo đề phía trên giúp bạn bắt đầu bài kiểm tra đầu tiên.
        </p>
      </div>
    )}
  </section>
);

export default RecentQuizzesPanel;
