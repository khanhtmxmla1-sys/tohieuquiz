import { AlertCircle, CheckSquare, Square } from 'lucide-react';
import type { BatchStudentRow } from './types';

interface StudentSelectionListProps {
  loading: boolean;
  totalStudents: number;
  filtered: BatchStudentRow[];
  selectedIds: Set<string>;
  quizId: string;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
}

export const StudentSelectionList = (props: StudentSelectionListProps) => {
  if (props.loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-9 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (props.totalStudents === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
        <AlertCircle size={15} /> Lớp này chưa có học sinh
      </div>
    );
  }

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 select-none"
        onClick={props.onToggleAll}
      >
        {props.filtered.every(student => props.selectedIds.has(student.id))
          ? <CheckSquare size={15} className="text-blue-500" />
          : <Square size={15} className="text-slate-400" />}
        <span className="text-xs font-semibold text-slate-600">
          Chọn tất cả ({props.filtered.length})
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
        {props.filtered.map(student => (
          <div
            key={student.id}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors select-none ${
              props.selectedIds.has(student.id) ? 'bg-blue-50/40' : ''
            }`}
            onClick={() => props.onToggleOne(student.id)}
          >
            {props.selectedIds.has(student.id)
              ? <CheckSquare size={15} className="shrink-0 text-blue-500" />
              : <Square size={15} className="shrink-0 text-slate-300" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{student.fullName}</p>
              <p className="text-xs text-slate-400">{student.username}</p>
            </div>
            {props.quizId && (
              <div className="shrink-0 text-right min-w-[40px]">
                {student.score !== null
                  ? <span className="text-sm font-semibold text-emerald-600">{student.score}</span>
                  : <span className="text-xs text-slate-300">—</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
