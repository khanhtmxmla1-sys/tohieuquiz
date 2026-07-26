import { AnimatePresence, motion } from 'framer-motion';
import MathSpan from '@/src/components/common/MathSpan';
import { cleanOptionText } from '../model';
import type { StudentAttendanceController } from '../hooks/useStudentAttendance';

export const AttendanceModal = ({ attendance }: { attendance: StudentAttendanceController }) => (
  <AnimatePresence>
    {attendance.isOpen && attendance.question && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-0 md:p-4 flex items-end md:items-center justify-center"
        onClick={() => !attendance.isSubmitting && attendance.close()}>
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(event) => event.stopPropagation()}
          className="w-full h-dvh md:h-auto md:max-w-2xl bg-white rounded-none md:rounded-3xl p-4 md:p-8 shadow-2xl overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs font-black text-blue-600 uppercase tracking-wider mb-1">Điểm danh nhận thưởng</p>
              <h3 className="text-xl md:text-2xl font-black text-slate-800">Câu hỏi ngẫu nhiên</h3>
              <p className="text-sm text-slate-500 mt-1">Nguồn: {attendance.question.quizTitle}</p>
            </div>
            <button type="button" onClick={attendance.close}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold">Đóng</button>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 md:p-5 mb-4">
            <MathSpan content={attendance.question.question || ''}
              className="text-blue-900 font-semibold leading-relaxed" />
          </div>
          <div className="space-y-3 mb-5">
            {attendance.question.options.map((option, index) => {
              const label = String.fromCharCode(65 + index);
              const selected = attendance.selectedAnswer === label;
              const correct = attendance.result !== null && label === attendance.question?.correctLabel;
              const wrong = attendance.result === 'wrong' && selected && !correct;
              const stateClass = correct ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : wrong ? 'border-red-400 bg-red-50 text-red-700'
                  : selected ? 'border-indigo-400 bg-indigo-50 text-blue-800'
                    : 'border-slate-200 hover:border-indigo-300 bg-white';
              return (
                <button key={`${attendance.question?.id}-${label}`} type="button"
                  disabled={attendance.result !== null || attendance.isSubmitting}
                  onClick={() => attendance.selectAnswer(label)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-colors flex items-center gap-3 ${stateClass}`}>
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">{label}</span>
                  <MathSpan content={cleanOptionText(option)} className="font-medium text-slate-700" />
                </button>
              );
            })}
          </div>
          {attendance.message && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold mb-5 ${attendance.result === 'correct'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'}`}>{attendance.message}</div>
          )}
          <div className="flex items-center justify-end gap-3">
            {attendance.result === 'wrong' && !attendance.claimedToday && (
              <button type="button" onClick={attendance.open}
                className="px-4 py-2 rounded-xl border border-indigo-200 text-blue-700 font-bold hover:bg-indigo-50">Câu khác</button>
            )}
            <button type="button" onClick={attendance.close}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">Đóng</button>
            {attendance.result === null && (
              <button type="button" onClick={() => void attendance.submit()}
                disabled={!attendance.selectedAnswer || attendance.isSubmitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed">
                {attendance.isSubmitting ? 'Đang kiểm tra...' : 'Xác nhận đáp án'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
