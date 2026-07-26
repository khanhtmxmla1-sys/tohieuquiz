import React from 'react';
import { Timer } from 'lucide-react';

interface QuizHeaderProps {
  title: string;
  timeLeft: number;
  totalQuestions: number;
  answeredCount: number;
  isPractice: boolean;
  studentName?: string;
  avatar?: string | null;
}

const QuizHeader: React.FC<QuizHeaderProps> = ({
  title,
  timeLeft,
  totalQuestions,
  answeredCount,
  isPractice,
  studentName,
}) => {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const progressPercentage = totalQuestions > 0
    ? Math.min(100, Math.max(0, (answeredCount / totalQuestions) * 100))
    : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-[#FFFDF7]">
      <div className="mx-auto max-w-[1180px] px-4 py-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-[#172033] sm:text-lg">{title}</h1>
              <p className="mt-0.5 truncate text-xs text-[#526174]">
                {studentName ? `${studentName} · ` : ''}Đã làm {answeredCount}/{totalQuestions} câu
              </p>
            </div>
          </div>

          {!isPractice ? (
            <div
              className={`flex shrink-0 items-center gap-2 text-sm font-semibold ${
                timeLeft < 60 ? 'text-[#E76F51]' : 'text-slate-700'
              }`}
              aria-label={`Thời gian còn lại ${formatTime(timeLeft)}`}
            >
              <Timer className="h-5 w-5" aria-hidden="true" />
              <span className="font-mono text-lg tracking-wide sm:text-xl">{formatTime(timeLeft)}</span>
            </div>
          ) : (
            <span className="shrink-0 text-sm font-medium text-slate-500">Luyện tập</span>
          )}
        </div>

        <div
          role="progressbar"
          aria-label="Tiến độ trả lời"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, totalQuestions)}
          aria-valuenow={Math.min(Math.max(0, answeredCount), Math.max(0, totalQuestions))}
          className="mt-3 h-1.5 overflow-hidden rounded-[3px] bg-slate-200"
        >
          <div
            className="h-full bg-sky-500 transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </header>
  );
};

export default QuizHeader;
