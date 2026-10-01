import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RefreshCw, Trophy, Users, X } from 'lucide-react';
import { getStudentLeaderboard } from '../../services/gamificationService';
import type {
  StudentLeaderboardData,
  StudentLeaderboardEntry,
  StudentLeaderboardQuery,
} from '../../types/gamification.types';
import { getAvatarUrl } from '../../config/avatars';
import { formatSystemDate, formatSystemTime, getSystemDateKey } from '../../utils/dateTime';

type LeaderboardTab = 'week' | 'class' | 'school';

const TAB_CONFIG: Record<LeaderboardTab, { label: string; query: StudentLeaderboardQuery }> = {
  week: { label: 'Tuần này', query: { scope: 'school', period: 'week' } },
  class: { label: 'Lớp của em', query: { scope: 'class', period: 'all' } },
  school: { label: 'Toàn trường', query: { scope: 'school', period: 'all' } },
};

const TROPHY_MASCOT_SRC = '/assets/gamification/cheerful-golden-trophy-mascot.png';

const xuFormatter = new Intl.NumberFormat('vi-VN');

const formatXu = (xu: number): string => `${xuFormatter.format(Math.max(0, xu))} xu`;

const formatUpdatedAt = (updatedAt: string): string => {
  const date = new Date(updatedAt);
  if (!Number.isFinite(date.getTime())) return 'Cập nhật mới nhất';
  const dateLabel = formatSystemDate(date, '');
  const timeLabel = formatSystemTime(date, '');
  if (!dateLabel || !timeLabel) return 'Cập nhật mới nhất';
  return getSystemDateKey(date) === getSystemDateKey()
    ? `Cập nhật lúc ${timeLabel} hôm nay`
    : `Cập nhật lúc ${timeLabel} ${dateLabel}`;
};

const studentKey = (student: StudentLeaderboardEntry): string => student.studentId || student.fullName;

function Avatar({ student, size = 'md' }: { student: StudentLeaderboardEntry; size?: 'md' | 'lg' }) {
  const [src, setSrc] = useState(() => getAvatarUrl(student.avatar ?? undefined));
  const dimension = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';

  useEffect(() => {
    setSrc(getAvatarUrl(student.avatar ?? undefined));
  }, [student.avatar]);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`${dimension} shrink-0 rounded-full border-2 border-[#F5D79A] bg-[#FFF7E6] object-cover`}
      onError={() => setSrc(getAvatarUrl())}
    />
  );
}

function StudentMeta({
  student,
  showClassName,
}: {
  student: StudentLeaderboardEntry;
  showClassName: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-[#3E3027]">{student.fullName}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#806C5B]">
        <span>{formatXu(student.xu)}</span>
        {showClassName && student.className ? <span>{student.className}</span> : null}
      </div>
    </div>
  );
}

function PodiumCard({
  student,
  showClassName,
  podiumPosition,
}: {
  student: StudentLeaderboardEntry;
  showClassName: boolean;
  podiumPosition: 1 | 2 | 3;
}) {
  const isFirst = podiumPosition === 1;
  return (
    <article
      className={`flex min-w-0 flex-col items-center rounded-2xl border px-2 py-3 text-center ${
        isFirst
          ? 'order-2 border-[#E8B94D] bg-[#FFF2C7] shadow-[0_8px_20px_rgba(205,143,27,0.14)] md:-translate-y-2'
          : podiumPosition === 2
            ? 'order-1 border-[#E5C9A4] bg-[#FFF9ED]'
            : 'order-3 border-[#E8D8C5] bg-[#FFFCF6]'
      }`}
    >
      <span className="text-xs font-bold tracking-wide text-[#977047]">#{student.rank}</span>
      <div className="relative mt-1">
        <Avatar student={student} size={isFirst ? 'lg' : 'md'} />
        {isFirst ? (
          <Trophy
            aria-hidden="true"
            className="absolute -right-2 -top-3 h-5 w-5 fill-[#E8B94D] text-[#B7791F]"
          />
        ) : null}
      </div>
      <p className="mt-2 w-full truncate text-xs font-semibold text-[#3E3027]">{student.fullName}</p>
      <p className="mt-0.5 text-xs font-bold text-[#B16D1E]">{formatXu(student.xu)}</p>
      {showClassName && student.className ? (
        <p className="mt-0.5 truncate text-[11px] text-[#957C68]">{student.className}</p>
      ) : null}
    </article>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3" aria-label="Đang tải bảng vàng" aria-busy="true">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-[#F8EEDC]" />
        ))}
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-[#F8EEDC]" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E8D8C5] bg-[#FFFCF6] px-5 py-10 text-center">
      <Users aria-hidden="true" className="h-9 w-9 text-[#C9A87B]" />
      <p className="mt-3 text-sm font-semibold text-[#5A4537]">Bảng vàng đang chờ những người đầu tiên!</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[#806C5B]">Hãy làm bài và tích lũy xu nhé.</p>
    </div>
  );
}

export const StudentFloatingSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('week');
  const [data, setData] = useState<StudentLeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogTitleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const requestIdRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  const loadLeaderboard = useCallback(async (query: StudentLeaderboardQuery) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    setData(null);
    try {
      const nextData = await getStudentLeaderboard(query);
      if (requestId === requestIdRef.current) setData(nextData);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải bảng vàng.');
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadLeaderboard(TAB_CONFIG[activeTab].query);
  }, [activeTab, isOpen, loadLeaderboard]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) previouslyFocusedRef.current?.focus();
  }, [isOpen]);

  const openLeaderboard = () => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const closeLeaderboard = () => setIsOpen(false);
  const activeConfig = TAB_CONFIG[activeTab];
  const showClassName = activeConfig.query.scope === 'school';
  const topStudents = data?.topStudents ?? [];
  const podiumStudents = [
    { student: topStudents.find((entry) => entry.rank === 2), position: 2 as const },
    { student: topStudents.find((entry) => entry.rank === 1), position: 1 as const },
    { student: topStudents.find((entry) => entry.rank === 3), position: 3 as const },
  ].filter((podium): podium is { student: StudentLeaderboardEntry; position: 1 | 2 | 3 } => Boolean(podium.student));
  const podiumKeys = new Set(podiumStudents.map(({ student }) => studentKey(student)));
  const remainingStudents = topStudents.filter((student) => !podiumKeys.has(studentKey(student))).slice(0, 10);
  const periodCopy = activeConfig.query.period === 'week'
    ? 'Xu kiếm được trong tuần này'
    : 'Số xu hiện có trong tài khoản';

  return (
    <>
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-40 md:bottom-5 md:right-5">
        <button
          ref={triggerRef}
          type="button"
          onClick={openLeaderboard}
          aria-label="Mở bảng vàng học sinh"
          aria-expanded={isOpen}
          aria-controls="student-golden-board-popup"
          className="group flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#E4B557] bg-white p-1 shadow-[0_8px_24px_rgba(151,112,71,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C98524] focus-visible:ring-offset-2 md:h-16 md:w-16"
        >
          <img
            src={TROPHY_MASCOT_SRC}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
          />
        </button>
      </div>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="student-leaderboard-layer"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-end justify-end p-3 pb-[calc(9rem+env(safe-area-inset-bottom))] md:p-5 md:pb-24"
          >
            <motion.button
              type="button"
              aria-label="Đóng lớp phủ bảng vàng"
              onClick={closeLeaderboard}
              data-motion="backdrop"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
              className="absolute inset-0 bg-[#3E3027]/35 transition-opacity duration-200 motion-reduce:transition-none"
            />

            <motion.section
              ref={dialogRef}
              id="student-golden-board-popup"
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              data-motion="dialog"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
              className="relative flex max-h-[85dvh] w-full max-w-[22rem] flex-col overflow-hidden rounded-[24px] border border-[#E8D8C5] bg-[#FFFDF7] text-[#3E3027] shadow-[0_20px_60px_rgba(62,48,39,0.22)] transition duration-200 motion-reduce:transition-none md:max-h-[70vh]"
            >
            <div className="flex items-start justify-between gap-4 border-b border-[#F0E4D4] bg-[#FFF9ED] px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
              <div>
                <div className="flex items-center gap-2">
                  <img
                    src={TROPHY_MASCOT_SRC}
                    alt=""
                    aria-hidden="true"
                    className="h-10 w-10 shrink-0 object-contain"
                  />
                  <div>
                    <h2 id={dialogTitleId} className="text-lg font-bold text-[#3E3027] sm:text-xl">Bảng vàng học sinh</h2>
                    <p className="text-xs text-[#806C5B] sm:text-sm">{periodCopy}</p>
                  </div>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeLeaderboard}
                aria-label="Đóng bảng vàng"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#806C5B] transition-colors hover:bg-[#F8EEDC] hover:text-[#3E3027] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C98524]"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-[#F0E4D4] bg-[#FFFDF7] px-4 pt-3 sm:px-7 sm:pt-4">
              <div role="tablist" aria-label="Phạm vi bảng vàng" className="flex gap-1 overflow-x-auto rounded-xl bg-[#FFF7E8] p-1">
                {(Object.keys(TAB_CONFIG) as LeaderboardTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-controls="student-leaderboard-panel"
                    onClick={() => setActiveTab(tab)}
                    className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C98524] sm:text-sm ${
                      activeTab === tab ? 'bg-[#FFFDF7] text-[#A5631D] shadow-sm' : 'text-[#8B7765] hover:text-[#5A4537]'
                    }`}
                  >
                    {TAB_CONFIG[tab].label}
                  </button>
                ))}
              </div>
            </div>

            <div id="student-leaderboard-panel" role="tabpanel" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-6 sm:pt-5">
              {isLoading ? <LeaderboardSkeleton /> : null}

              {!isLoading && error ? (
                <div role="alert" className="flex flex-col items-center justify-center rounded-2xl border border-[#EBC7B1] bg-[#FFF5EF] px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-[#8F4B32]">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadLeaderboard(activeConfig.query)}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#B16D1E] px-4 text-sm font-bold text-white transition-colors hover:bg-[#8F5718] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C98524] focus-visible:ring-offset-2"
                  >
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    Thử lại
                  </button>
                </div>
              ) : null}

              {!isLoading && !error && data && data.topStudents.length === 0 && !data.currentStudent ? <EmptyState /> : null}

              {!isLoading && !error && data && (data.topStudents.length > 0 || data.currentStudent) ? (
                <>
                  {data.currentStudent ? (
                    <section aria-label="Vị trí của em" className="mb-5 rounded-2xl border border-[#E7C77F] bg-[#FFF4D3] px-4 py-3 sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar student={data.currentStudent} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#A5631D]">Vị trí của em</p>
                            <StudentMeta student={data.currentStudent} showClassName={showClassName} />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-extrabold text-[#A5631D]">#{data.currentStudent.rank}</p>
                          {data.currentStudent.gapToNext && data.currentStudent.gapToNext > 0 ? (
                            <p className="mt-0.5 text-[11px] text-[#8B6D35]">
                              Còn {formatXu(data.currentStudent.gapToNext)} để vượt hạng {Math.max(1, data.currentStudent.rank - 1)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {podiumStudents.length > 0 ? (
                    <section aria-label="Top 3" className="mb-5">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#5A4537]">Top 3</h3>
                        <span className="text-xs text-[#957C68]">{data.totalStudents} học sinh</span>
                      </div>
                      <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
                        {podiumStudents.map(({ student, position }) => (
                          <PodiumCard key={studentKey(student)} student={student} podiumPosition={position} showClassName={showClassName} />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {remainingStudents.length > 0 ? (
                    <section aria-label="Danh sách top 10">
                      <h3 className="mb-2 text-sm font-bold text-[#5A4537]">Top 10</h3>
                      <ol className="divide-y divide-[#F0E4D4] rounded-2xl border border-[#F0E4D4] bg-[#FFFEFA]">
                        {remainingStudents.map((student) => (
                          <li key={studentKey(student)} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                            <span className="w-7 shrink-0 text-center text-sm font-bold text-[#9B8067]">{student.rank}</span>
                            <Avatar student={student} />
                            <StudentMeta student={student} showClassName={showClassName} />
                          </li>
                        ))}
                      </ol>
                    </section>
                  ) : null}
                </>
              ) : null}
              {data ? (
                <p className="mt-5 border-t border-[#F0E4D4] pt-3 text-center text-xs text-[#957C68]">
                  {formatUpdatedAt(data.updatedAt)}
                </p>
              ) : null}
            </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};
