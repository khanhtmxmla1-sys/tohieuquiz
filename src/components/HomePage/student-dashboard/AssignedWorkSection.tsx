import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { AssignedWorkSkeleton, DashboardEmptyState, DashboardSectionError } from './DashboardStates';
import type { AssignedWorkSectionProps } from './dashboard.types';
import { getAssignmentActionLabel, getAssignmentVisualState } from './dashboard.utils';

export function AssignedWorkSection({
  quizzes,
  isLoading,
  errorMessage,
  page,
  totalPages,
  reviewingAssignmentId,
  onRetry,
  onPageChange,
  onStartQuiz,
  onReviewQuiz,
}: AssignedWorkSectionProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  return (
    <section id="assigned-work" aria-labelledby="assigned-work-title" className="scroll-mt-24">
      <div className="mb-4">
        <h2 id="assigned-work-title" className="text-2xl font-semibold text-[#172033]">
          Bài được giao
        </h2>
        <p className="mt-1 text-sm text-[#526174]">
          Theo dõi hạn nộp và số lượt làm còn lại của từng bài.
        </p>
      </div>

      {isLoading ? <AssignedWorkSkeleton /> : null}

      {!isLoading && errorMessage ? (
        <DashboardSectionError message={errorMessage} onRetry={onRetry} />
      ) : null}

      {!isLoading && !errorMessage && quizzes.length === 0 ? (
        <DashboardEmptyState
          title="Em đã hoàn thành tất cả nhiệm vụ hiện tại."
          description="Em có thể tiếp tục luyện thêm một môn học ở thư viện bên dưới."
        />
      ) : null}

      {!isLoading && !errorMessage && quizzes.length > 0 ? (
        <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
          {quizzes.map((quiz) => {
            const assignment = quiz._assignmentData;
            const visualState = getAssignmentVisualState(quiz);
            const actionLabel = getAssignmentActionLabel(visualState);
            const isReady = visualState === 'ready';
            const isCompleted = visualState === 'completed';
            const isReviewing = isCompleted
              && String(reviewingAssignmentId || '') === String(assignment?.id || '');
            const attemptCount = Math.max(0, Number(assignment?.attemptCount) || 0);
            const maxAttempts = Math.max(1, Number(assignment?.maxAttempts) || 1);
            const remainingAttempts = Math.max(0, maxAttempts - attemptCount);
            const deadline = assignment?.deadline ? new Date(assignment.deadline) : null;
            const deadlineText = deadline && !Number.isNaN(deadline.getTime())
              ? deadline.toLocaleDateString('vi-VN')
              : 'Không giới hạn';

            return (
              <article
                key={assignment?.id || quiz.id}
                className="border-b border-[#E5E7EB] px-4 py-5 last:border-b-0 sm:px-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h3 className="line-clamp-2 text-base font-semibold text-[#172033] sm:text-lg">
                        {quiz.title}
                      </h3>
                      <span
                        className={`text-xs font-medium ${
                          visualState === 'completed'
                            ? 'text-emerald-700'
                            : visualState === 'closed'
                              ? 'text-slate-500'
                              : 'text-amber-700'
                        }`}
                      >
                        {visualState === 'completed'
                          ? 'Đã hoàn thành'
                          : visualState === 'closed'
                            ? 'Đã đóng'
                            : 'Cần làm'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#526174]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        {quiz.timeLimit || 0} phút
                      </span>
                      <span>
                        Hạn:{' '}
                        <span className={visualState === 'closed' ? 'text-[#E76F51]' : 'text-amber-700'}>
                          {deadlineText}
                        </span>
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-slate-700">
                      Đã làm {attemptCount}/{maxAttempts} lượt • Còn {remainingAttempts} lượt
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isReady) onStartQuiz(quiz);
                      else if (isCompleted) onReviewQuiz(quiz);
                    }}
                    disabled={visualState === 'closed' || isReviewing}
                    aria-busy={isReviewing}
                    className={`inline-flex min-h-11 w-full items-center justify-center rounded-[10px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto sm:min-w-36 ${
                      isReady
                        ? 'bg-sky-500 text-white hover:bg-sky-600 focus-visible:ring-sky-500'
                        : isCompleted
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-500 disabled:cursor-wait'
                          : 'cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isReviewing ? 'Đang tải bài...' : actionLabel}
                  </button>
                </div>
              </article>
            );
          })}

          {safeTotalPages > 1 ? (
            <nav
              aria-label="Phân trang bài được giao"
              className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-3"
            >
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Trước
              </button>
              <span className="text-sm font-medium text-slate-600">
                Trang {safePage}/{safeTotalPages}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
                disabled={safePage >= safeTotalPages}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                Sau
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
