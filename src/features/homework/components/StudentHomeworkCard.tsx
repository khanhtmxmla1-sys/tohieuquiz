import React from 'react';
import type { HomeworkAssignment, HomeworkSubmission } from '../types';
import MathSpan from '../../../components/common/MathSpan';

interface StudentHomeworkCardProps {
  assignment: HomeworkAssignment;
  submission?: HomeworkSubmission;
  onClick: (assignment: HomeworkAssignment) => void;
}

export const StudentHomeworkCard: React.FC<StudentHomeworkCardProps> = ({
  assignment,
  submission,
  onClick,
}) => {
  const isSubmitted = Boolean(submission);
  const isGraded = submission?.status === 'GRADED';
  const isClosed =
    assignment.effectiveStatus === 'EXPIRED' || assignment.effectiveStatus === 'CLOSED';
  const deadlineDate = new Date(assignment.deadline);
  const isOverdue = !isSubmitted && deadlineDate < new Date();

  const statusLabel = isGraded
    ? 'Đã chấm'
    : isSubmitted
      ? 'Đã nộp'
      : isClosed
        ? 'Đã đóng'
        : 'Cần làm';

  const statusClass = isGraded
    ? 'text-emerald-700'
    : isSubmitted
      ? 'text-sky-700'
      : isClosed || isOverdue
        ? 'text-[#E76F51]'
        : 'text-amber-700';

  const actionLabel = isGraded
    ? 'Xem lỗi sai'
    : isSubmitted
      ? 'Xem bài nộp'
      : isOverdue || isClosed
        ? 'Xem đề'
        : 'Làm bài ngay';

  return (
    <article className="border-b border-[#E5E7EB] p-4 last:border-b-0 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="line-clamp-2 text-base font-semibold text-[#172033] sm:text-lg">
              {assignment.title}
            </h3>
            <span className={`text-xs font-medium ${statusClass}`}>{statusLabel}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#526174]">
            <span>Môn: {assignment.subject || 'Tự luận'}</span>
            <span>
              Hạn:{' '}
              <span className={isOverdue || isClosed ? 'text-[#E76F51]' : 'text-amber-700'}>
                {deadlineDate.toLocaleDateString('vi-VN')}
              </span>
            </span>
          </div>

          {assignment.description ? (
            <MathSpan
              content={assignment.description}
              as="p"
              className="mt-2 line-clamp-2 text-sm leading-6 text-[#526174]"
            />
          ) : null}

          <p className="mt-2 text-sm font-medium text-slate-700">
            {isGraded
              ? `Điểm số: ${submission?.score}/10`
              : isSubmitted
                ? 'Đã nộp bài · Đang chờ chấm điểm'
                : isOverdue || isClosed
                  ? 'Đã hết hạn nộp'
                  : 'Chưa nộp bài'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onClick(assignment)}
          className={`inline-flex min-h-11 w-full items-center justify-center rounded-[10px] px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto ${
            isGraded
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : isSubmitted
                ? 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                : isOverdue || isClosed
                  ? 'border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-sky-500 text-white hover:bg-sky-600'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
};
