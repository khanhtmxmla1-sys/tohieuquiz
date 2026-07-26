import { DashboardEmptyState, DashboardSectionError } from './DashboardStates';
import type { SubjectPracticeGridProps } from './dashboard.types';

const PracticeListSkeletons = () => (
  <div
    aria-label="Đang tải thư viện luyện tập"
    aria-busy="true"
    className="overflow-hidden rounded-[14px] border border-slate-200 bg-white"
  >
    {Array.from({ length: 3 }, (_, index) => (
      <div
        key={index}
        data-testid="practice-card-skeleton"
        className="animate-pulse border-b border-slate-100 p-5 last:border-b-0 motion-reduce:animate-none"
        aria-hidden="true"
      >
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full rounded bg-slate-100" />
        <div className="mt-2 h-4 w-3/4 rounded bg-slate-100" />
      </div>
    ))}
  </div>
);

export function SubjectPracticeGrid({
  availableSubjects,
  comingSoonSubjects,
  isLoading,
  errorMessage,
  onRetry,
  onSelectSubject,
}: SubjectPracticeGridProps) {
  return (
    <section id="practice-library" aria-labelledby="practice-library-title" className="scroll-mt-24">
      <div className="mb-5">
        <h2 id="practice-library-title" className="text-2xl font-semibold text-[#172033]">
          Thư viện luyện tập
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#526174]">
          Chọn môn đang có để luyện theo từng chuyên đề.
        </p>
      </div>

      {isLoading ? <PracticeListSkeletons /> : null}

      {!isLoading && errorMessage ? (
        <DashboardSectionError message={errorMessage} onRetry={onRetry} />
      ) : null}

      {!isLoading && !errorMessage ? (
        <div className="space-y-7">
          {availableSubjects.length > 0 ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-500">Môn đang có</h3>
              <div
                data-testid="subject-practice-grid"
                className="grid grid-cols-1 overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white sm:grid-cols-2 lg:grid-cols-3"
              >
                {availableSubjects.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => onSelectSubject(subject.id)}
                    className="group flex min-h-40 w-full flex-col border-b border-r border-slate-100 p-5 text-left transition-colors hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
                  >
                    <span className="text-lg font-semibold text-[#172033]">{subject.title}</span>
                    <span className="mt-2 flex-1 text-sm leading-6 text-[#526174]">
                      {subject.description}
                    </span>
                    <span className="mt-4 border-t border-slate-100 pt-3 text-sm font-medium text-slate-600">
                      {subject.topicCount} chuyên đề · {subject.questionCount} câu hỏi
                    </span>
                    <span className="mt-2 text-sm font-semibold text-sky-700">Luyện ngay</span>
                  </button>
                ))}
              </div>
            </div>
          ) : comingSoonSubjects.length === 0 ? (
            <DashboardEmptyState
              title="Hiện chưa có môn luyện tập nào dành cho em."
              description="Các môn có chuyên đề luyện tập sẽ xuất hiện tại đây."
            />
          ) : null}

          {comingSoonSubjects.length > 0 ? (
            <div aria-labelledby="coming-soon-subjects-title">
              <h3 id="coming-soon-subjects-title" className="mb-3 text-sm font-semibold text-slate-500">
                Sắp có
              </h3>
              <ul className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                {comingSoonSubjects.map((subject) => (
                  <li
                    key={subject.id}
                    className="flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 font-medium text-slate-700">{subject.title}</span>
                    <span className="text-xs font-medium text-slate-500">Đang chuẩn bị</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
