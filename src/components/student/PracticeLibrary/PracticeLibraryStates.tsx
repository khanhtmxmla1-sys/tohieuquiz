import { AlertCircle, ArrowLeft, BookOpen, SearchX } from 'lucide-react';

export const PracticeTopicSkeletons = ({ count = 6 }: { count?: number }) => (
  <div
    aria-label="Đang tải chuyên đề luyện tập"
    aria-busy="true"
    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    {Array.from({ length: Math.max(0, count) }, (_, index) => (
      <div
        key={index}
        data-testid="practice-topic-skeleton"
        aria-hidden="true"
        className="min-h-44 animate-pulse rounded-3xl border border-slate-200 bg-white p-5 motion-reduce:animate-none"
      >
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="mt-5 h-6 w-2/3 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-28 rounded bg-slate-100" />
        <div className="mt-10 h-11 w-32 rounded-xl bg-slate-100" />
      </div>
    ))}
  </div>
);

export const PracticeSubjectEmptyState = () => (
  <div
    role="status"
    className="flex flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"
  >
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
      <BookOpen className="h-6 w-6" aria-hidden="true" />
    </span>
    <h2 className="mt-4 text-lg font-black text-slate-900">Môn này đang được chuẩn bị.</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
      Các chuyên đề mới sẽ xuất hiện tại đây khi giáo viên hoàn tất nội dung.
    </p>
  </div>
);

export const PracticeSearchEmptyState = ({ query }: { query: string }) => (
  <div
    role="status"
    className="flex flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"
  >
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
      <SearchX className="h-6 w-6" aria-hidden="true" />
    </span>
    <h2 className="mt-4 text-lg font-black text-slate-900">
      Không tìm thấy chuyên đề phù hợp.
    </h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
      Thử một từ khóa ngắn hơn thay cho “{query}”.
    </p>
  </div>
);

export const PracticeLibraryError = ({ onRetry }: { onRetry: () => void }) => (
  <div
    role="alert"
    className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-rose-950"
  >
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">Chưa tải được thư viện luyện tập.</p>
        <p className="mt-1 text-sm leading-6 text-rose-800">
          Kiểm tra kết nối rồi thử lại để xem các chuyên đề.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-300 bg-white px-4 text-sm font-bold text-rose-800 shadow-sm transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        >
          Thử lại
        </button>
      </div>
    </div>
  </div>
);

export const InvalidPracticeSubject = ({ onBack }: { onBack: () => void }) => (
  <main className="flex min-h-dvh w-full items-center justify-center bg-[#F4F7FC] px-4 py-10">
    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <BookOpen className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-black text-slate-900">Không tìm thấy môn học</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Đường dẫn này không thuộc thư viện luyện tập hiện có.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Trở về thư viện
      </button>
    </div>
  </main>
);
