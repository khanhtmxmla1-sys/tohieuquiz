import { useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MathSpan from '@/src/components/common/MathSpan';
import QuestionRichTextRenderer from '@/src/components/common/QuestionRichTextRenderer';
import SafeRasterImage from '@/src/components/common/SafeRasterImage';
import { useDialogFocus } from '@/src/hooks/useDialogFocus';
import type { StudentAttendanceController } from '../hooks/useStudentAttendance';

export const AttendanceModal = ({ attendance }: { attendance: StudentAttendanceController }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = () => {
    if (!attendance.isSubmitting) attendance.close();
  };

  useDialogFocus({
    isOpen: attendance.isOpen,
    dialogRef,
    initialFocusRef: closeRef,
    onClose: close,
  });

  return (
    <AnimatePresence>
      {attendance.isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="h-dvh w-full overflow-y-auto bg-white p-4 shadow-2xl md:h-auto md:max-w-2xl md:rounded-3xl md:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-sky-700">
                  Điểm danh nhận thưởng
                </p>
                <h3 id={titleId} className="text-xl font-bold text-slate-900 md:text-2xl">
                  Điểm danh hôm nay
                </h3>
                <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                  {attendance.completed
                    ? 'Em đã hoàn thành 2 câu hỏi.'
                    : `Câu ${attendance.currentNumber}/${attendance.attempt?.totalQuestions ?? 2}`}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                disabled={attendance.isSubmitting}
                aria-label="Đóng hộp thoại điểm danh"
                className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-60"
              >
                Đóng
              </button>
            </div>

            {attendance.completed && attendance.attempt ? (
              <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <p className="text-lg font-bold text-emerald-800">Đã điểm danh</p>
                <p className="mt-2 text-sm text-emerald-800">
                  Em trả lời đúng {attendance.attempt.correctCount}/{attendance.attempt.totalQuestions} câu
                </p>
                <p className="mt-3 font-bold text-emerald-900">
                  +{attendance.attempt.awardedCoins ?? 5} Xu · +{attendance.attempt.awardedExp ?? 10} EXP
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 min-h-11 rounded-[10px] bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Hoàn tất
                </button>
              </div>
            ) : attendance.currentItem ? (
              <>
                <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 md:p-5">
                  {attendance.currentItem.questionRichText ? (
                    <QuestionRichTextRenderer
                      value={attendance.currentItem.questionRichText}
                      fallback={attendance.currentItem.question}
                      className="font-semibold leading-relaxed text-slate-900"
                    />
                  ) : (
                    <MathSpan
                      content={attendance.currentItem.question}
                      className="font-semibold leading-relaxed text-slate-900"
                    />
                  )}
                </div>

                {attendance.currentItem.image ? (
                  <SafeRasterImage
                    src={attendance.currentItem.image}
                    alt={attendance.currentItem.imageAlt || 'Hình minh họa câu hỏi'}
                    className="mx-auto mb-4 block max-h-64 max-w-full rounded-[10px] border border-slate-200 bg-white object-contain"
                  />
                ) : null}

                <div className="mb-5 space-y-3">
                  {attendance.currentItem.options.map((option, index) => {
                    const label = String.fromCharCode(65 + index);
                    const selected = attendance.selectedAnswer === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        disabled={attendance.isSubmitting}
                        onClick={() => attendance.selectAnswer(label)}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${
                          selected
                            ? 'border-sky-500 bg-sky-50 text-sky-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                          {label}
                        </span>
                        <MathSpan content={option} className="font-medium" />
                      </button>
                    );
                  })}
                </div>

                {attendance.message ? (
                  <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {attendance.message}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void attendance.submit()}
                    disabled={!attendance.selectedAnswer || attendance.isSubmitting}
                    className="min-h-11 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {attendance.isSubmitting
                      ? 'Đang lưu...'
                      : attendance.currentNumber >= (attendance.attempt?.totalQuestions ?? 2)
                        ? 'Hoàn thành'
                        : 'Tiếp tục'}
                  </button>
                </div>
              </>
            ) : (
              <div role="status" className="py-10 text-center text-sm text-slate-500">
                Đang tải câu hỏi điểm danh...
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
