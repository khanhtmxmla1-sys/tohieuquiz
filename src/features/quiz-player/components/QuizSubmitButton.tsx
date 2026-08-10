import React from 'react';

interface QuizSubmitButtonProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  className?: string;
}

const QuizSubmitButton: React.FC<QuizSubmitButtonProps> = ({
  onSubmit,
  isSubmitting,
  className = '',
}) => (
  <button
    type="button"
    onClick={onSubmit}
    disabled={isSubmitting}
    className={`inline-flex min-h-12 items-center justify-center rounded-[10px] bg-sky-600 px-6 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
  >
    {isSubmitting ? 'Đang nộp bài...' : 'Nộp bài'}
  </button>
);

export default QuizSubmitButton;
