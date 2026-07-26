import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGamificationStore } from '../../stores/useGamificationStore';
import type { TopGoldStudent } from '../../types/gamification.types';
import { getAvatarUrl } from '../../config/avatars';

export const StudentFloatingSidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { topGoldLeaderboard, fetchTopGoldLeaderboard, isLoading } = useGamificationStore();

  useEffect(() => {
    if (topGoldLeaderboard.length === 0) {
      fetchTopGoldLeaderboard();
    }
  }, [fetchTopGoldLeaderboard, topGoldLeaderboard.length]);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-30 hidden md:block">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Mở bảng vàng học sinh"
          className="min-h-10 rounded-[10px] border border-slate-200 bg-[#FFFDF7] px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          Bảng vàng
        </button>
      </div>

      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Đóng bảng vàng"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 cursor-default bg-slate-900/25"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              aria-label="Bảng vàng TôHiệuQuiz"
              className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-[#FFFDF7]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-[#172033]">Bảng vàng TôHiệuQuiz</h2>
                  <p className="mt-1 text-sm text-[#526174]">10 học sinh có số xu cao nhất</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex min-h-10 items-center justify-center rounded-[10px] px-3 text-sm font-semibold text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Đóng
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-2">
                {isLoading ? (
                  <div className="space-y-2 py-4" aria-label="Đang tải bảng vàng" aria-busy="true">
                    {Array.from({ length: 5 }, (_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-[10px] bg-slate-100" />
                    ))}
                  </div>
                ) : topGoldLeaderboard.length === 0 ? (
                  <p className="py-8 text-center text-sm leading-6 text-slate-500">
                    Chưa có dữ liệu bảng xếp hạng.
                  </p>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {topGoldLeaderboard.map((student: TopGoldStudent, index: number) => (
                      <li key={student.username} className="flex items-center gap-3 py-3">
                        <span className="w-6 shrink-0 text-center text-sm font-semibold text-slate-500">
                          {index + 1}
                        </span>
                        <img
                          src={student.avatar ? getAvatarUrl(student.avatar) : getAvatarUrl('default')}
                          alt=""
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                          aria-hidden="true"
                          onError={(event) => {
                            event.currentTarget.src = getAvatarUrl('default');
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-slate-800">
                            {student.fullName}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">{student.coins.toLocaleString()} xu</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
};
