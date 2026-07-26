import type { StudentDashboardHeroProps } from './dashboard.types';

export function StudentDashboardHero({
  firstName,
  hasReadyAssignment,
  attendanceClaimed,
  attendanceLabel,
  attendanceAvailable,
  onPrimaryAction,
  onAttendance,
}: StudentDashboardHeroProps) {
  const primaryLabel = hasReadyAssignment ? 'Làm bài được giao' : 'Luyện tập ngay';
  const attendanceDisabled = !attendanceAvailable && !attendanceClaimed;

  return (
    <section className="rounded-[14px] border border-[#E7E2D8] bg-[#FFF9EA] px-5 py-6 sm:px-7 sm:py-8">
      <div className="flex max-w-3xl flex-col items-start gap-5">
        <div>
          <p className="mb-2 text-sm font-medium text-[#6B7280]">Hôm nay em muốn bắt đầu từ đâu?</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#172033] sm:text-3xl">
            Chào {firstName}.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526174] sm:text-base">
            Ưu tiên bài được giao trước, sau đó em có thể luyện thêm môn mình đang quan tâm.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-sky-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            {primaryLabel}
          </button>

          <button
            type="button"
            onClick={onAttendance}
            disabled={attendanceDisabled}
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-500"
          >
            {attendanceLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
