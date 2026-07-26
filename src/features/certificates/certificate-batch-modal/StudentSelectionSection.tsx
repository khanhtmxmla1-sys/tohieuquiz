import { Loader2, Search } from 'lucide-react';
import type { BatchStudentRow } from './types';
import { StudentSelectionList } from './StudentSelectionList';

interface StudentSelectionSectionProps {
  loadingStudents: boolean;
  loadingResults: boolean;
  totalStudents: number;
  selectedIds: Set<string>;
  filtered: BatchStudentRow[];
  search: string;
  setSearch: (value: string) => void;
  quizId: string;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
}

export const StudentSelectionSection = (props: StudentSelectionSectionProps) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="text-sm font-semibold text-slate-700">
        Học sinh
        {!props.loadingStudents && props.totalStudents > 0 && (
          <span className="ml-1.5 font-normal text-slate-400">
            ({props.selectedIds.size}/{props.totalStudents} đã chọn)
          </span>
        )}
      </label>
      {props.loadingResults && (
        <span className="flex items-center gap-1 text-xs text-blue-500">
          <Loader2 size={11} className="animate-spin" /> Đang tải điểm...
        </span>
      )}
    </div>
    <div className="relative mb-2">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={props.search}
        onChange={event => props.setSearch(event.target.value)}
        placeholder="Tìm theo tên hoặc tài khoản..."
        className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <StudentSelectionList
      loading={props.loadingStudents}
      totalStudents={props.totalStudents}
      filtered={props.filtered}
      selectedIds={props.selectedIds}
      quizId={props.quizId}
      onToggleAll={props.onToggleAll}
      onToggleOne={props.onToggleOne}
    />
  </div>
);
