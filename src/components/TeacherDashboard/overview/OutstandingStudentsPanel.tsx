import React, { useMemo } from 'react';
import { ArrowRight, Medal } from 'lucide-react';
import type { StudentResult } from '../../../types';

interface OutstandingStudentsPanelProps {
  results: StudentResult[];
  onViewResults: () => void;
}

const OutstandingStudentsPanel: React.FC<OutstandingStudentsPanelProps> = ({ results, onViewResults }) => {
  const students = useMemo(() => {
    const best = new Map<string, StudentResult>();
    results.forEach((result) => {
      const key = result.studentName.trim().toLocaleLowerCase('vi-VN');
      const current = best.get(key);
      if (!current || Number(result.score || 0) > Number(current.score || 0)) best.set(key, result);
    });
    return Array.from(best.values()).sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 4);
  }, [results]);

  return (
    <section aria-labelledby="outstanding-students-heading" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[var(--dashboard-card-shadow)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700">Ghi nhận tiến bộ</p>
          <h2 id="outstanding-students-heading" className="mt-1 text-xl font-bold text-slate-900">Học sinh nổi bật</h2>
        </div>
        <button type="button" onClick={onViewResults} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Xem kết quả <ArrowRight aria-hidden="true" className="size-4" /></button>
      </div>
      {students.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {students.map((student, index) => (
            <article key={`${student.studentName}-${student.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-blue-700 shadow-sm">{student.studentName.trim().charAt(0).toUpperCase() || '?'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><Medal aria-hidden="true" className={`size-4 ${index === 0 ? 'text-amber-500' : 'text-slate-400'}`} /><p className="truncate text-sm font-semibold text-slate-900">{student.studentName}</p></div>
                <p className="mt-1 text-xs text-slate-500">{student.studentClass || 'Chưa cập nhật lớp'}</p>
              </div>
              <span className="text-lg font-bold tabular-nums text-emerald-700">{Number(student.score || 0)}</span>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Học sinh nổi bật sẽ xuất hiện khi có kết quả bài làm.</div>
      )}
    </section>
  );
};

export default OutstandingStudentsPanel;
