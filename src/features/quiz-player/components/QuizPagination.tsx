import React from 'react';
import type { QuizPageChangeHandler } from '../hooks/useQuizPageNavigation';
import QuizSubmitButton from './QuizSubmitButton';

interface QuizPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: QuizPageChangeHandler;
  onSubmit: () => void;
  isSubmitting: boolean;
  hideSubmitOnDesktop?: boolean;
}

const QuizPagination: React.FC<QuizPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  onSubmit,
  isSubmitting,
  hideSubmitOnDesktop = false,
}) => {
  return (
    <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pb-12 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <button
          type="button"
          aria-label="Trang trước"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          Trang trước
        </button>

        <div
          role="status"
          aria-live="polite"
          className="px-3 py-2 text-sm font-medium text-slate-500"
        >
          Trang {currentPage} / {totalPages}
        </div>
      </div>

      {currentPage === totalPages ? (
        <QuizSubmitButton
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          className={`w-full sm:w-auto${hideSubmitOnDesktop ? ' lg:hidden' : ''}`}
        />
      ) : (
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-sky-500 px-6 text-base font-semibold text-white transition-colors hover:bg-sky-600 sm:w-auto"
        >
          Trang tiếp theo
        </button>
      )}
    </div>
  );
};

export default QuizPagination;
