import { AlertTriangle, CalendarClock, Clock3, ListChecks, School, UserRound } from 'lucide-react';
import type { Quiz } from '../../types';
import { formatSystemDateTime } from '../../utils/dateTime';

interface QuizStartNoticeProps {
  quiz: Quiz;
  studentName: string;
  studentClass: string;
  isStarting: boolean;
  startError: string | null;
  onStart: () => void | Promise<void>;
  onExit: () => void;
}

const formatDeadline = (value?: string): string => (
  value ? formatSystemDateTime(value, 'Không giới hạn') : 'Không giới hạn'
);

const QuizStartNotice = ({
  quiz,
  studentName,
  studentClass,
  isStarting,
  startError,
  onStart,
  onExit,
}: QuizStartNoticeProps) => {
  const assignment = quiz._assignmentData;
  const attemptCount = Math.max(0, Number(assignment?.attemptCount) || 0);
  const maxAttempts = Math.max(1, Number(assignment?.maxAttempts) || 1);
  const remainingAttempts = Math.max(0, maxAttempts - attemptCount);
  const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC] px-4 py-8 font-['Be_Vietnam_Pro'] text-[#172033] sm:px-6">
      <section
        aria-labelledby="quiz-start-title"
        className="w-full max-w-xl overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10)]"
      >
        <div className="border-b border-slate-200 bg-sky-50 px-5 py-5 sm:px-7">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-sky-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 id="quiz-start-title" className="text-2xl font-bold tracking-tight text-slate-900">
            Lưu ý trước khi làm bài
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Em hãy kiểm tra thông tin và đọc kỹ các lưu ý trước khi bắt đầu.
          </p>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bài làm</p>
            <h2 className="mt-1 text-lg font-semibold leading-7 text-slate-900">{quiz.title}</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3">
              <UserRound className="h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Học sinh</p>
                <p className="truncate font-semibold text-slate-800">{studentName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3">
              <School className="h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />
              <div>
                <p className="text-xs text-slate-500">Lớp</p>
                <p className="font-semibold text-slate-800">Lớp {studentClass}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[10px] border border-slate-200 px-3 py-3 text-center">
              <ListChecks className="mx-auto h-5 w-5 text-sky-600" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-slate-800">{questionCount} câu hỏi</p>
            </div>
            <div className="rounded-[10px] border border-slate-200 px-3 py-3 text-center">
              <Clock3 className="mx-auto h-5 w-5 text-sky-600" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-slate-800">{quiz.timeLimit || 0} phút</p>
            </div>
            <div className="rounded-[10px] border border-slate-200 px-3 py-3 text-center">
              <ListChecks className="mx-auto h-5 w-5 text-emerald-600" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-slate-800">Còn {remainingAttempts} lượt làm</p>
            </div>
            <div className="rounded-[10px] border border-slate-200 px-3 py-3 text-center">
              <CalendarClock className="mx-auto h-5 w-5 text-amber-600" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-800">
                {formatDeadline(assignment?.deadline)}
              </p>
            </div>
          </div>

          <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            Đồng hồ chỉ bắt đầu sau khi em bấm nút bên dưới. Bài sẽ tự động nộp khi hết thời gian.
          </div>

          {startError ? (
            <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {startError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onExit}
              disabled={isStarting}
              className="min-h-11 rounded-[10px] border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={() => void onStart()}
              disabled={isStarting || remainingAttempts <= 0}
              aria-busy={isStarting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-sky-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isStarting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              ) : null}
              <span>Bắt đầu làm bài</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default QuizStartNotice;
