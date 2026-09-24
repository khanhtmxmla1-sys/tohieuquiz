import { useEffect, useMemo, useState } from 'react';
import type { CoinAwardSelectionMode } from '../../../../shared/coin-awards.contract';
import type { Student } from '../../../types/classroom.types';

interface StudentRecipientPickerProps {
  students: Student[];
  selectionMode: CoinAwardSelectionMode;
  selectedStudentIds: string[];
  className: string;
  loading: boolean;
  error: string | null;
  onSelectionChange: (studentIds: string[]) => void;
  onRetry: () => void;
}

const normalizeSearch = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('vi')
  .trim();

export const StudentRecipientPicker = ({
  students,
  selectionMode,
  selectedStudentIds,
  className,
  loading,
  error,
  onSelectionChange,
  onRetry,
}: StudentRecipientPickerProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchTerm('');
  }, [className, selectionMode]);

  const selected = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);
  const filteredStudents = useMemo(() => {
    const keyword = normalizeSearch(searchTerm);
    if (!keyword) return students;
    return students.filter((student) => (
      normalizeSearch(student.fullName).includes(keyword)
      || normalizeSearch(student.username).includes(keyword)
    ));
  }, [searchTerm, students]);

  if (selectionMode === 'CLASS') {
    return (
      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
        {loading
          ? 'Đang tải danh sách học sinh…'
          : error
            ? 'Chưa thể tải danh sách học sinh.'
            : students.length === 0
              ? 'Lớp này chưa có học sinh.'
              : `Thưởng cho toàn bộ ${students.length} học sinh đang hoạt động của lớp ${className || 'đã chọn'}.`}
        {error && (
          <div className="mt-2">
            <span className="text-rose-700">{error}</span>
            <button type="button" onClick={onRetry} className="ml-3 font-semibold text-blue-700 hover:underline">
              Thử lại
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <label className="block text-sm font-medium text-slate-700">
        {selectionMode === 'STUDENT' ? 'Chọn học sinh' : 'Chọn nhiều học sinh'}
        <input
          aria-label="Tìm học sinh"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Nhập tên học sinh..."
          className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
        />
      </label>

      {selectionMode === 'SELECTED' && !loading && !error && students.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectionChange(Array.from(new Set([...selectedStudentIds, ...filteredStudents.map((student) => student.id)])))}
            disabled={filteredStudents.length === 0}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Chọn tất cả đang hiển thị
          </button>
          <button
            type="button"
            onClick={() => onSelectionChange(students.map((student) => student.id))}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Chọn tất cả học sinh
          </button>
          {selectedStudentIds.length > 0 && (
            <button
              type="button"
              onClick={() => onSelectionChange([])}
              className="min-h-9 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-white"
            >
              Bỏ chọn tất cả
            </button>
          )}
          <span className="text-xs font-semibold text-blue-700">Đã chọn {selectedStudentIds.length} học sinh</span>
        </div>
      )}

      <div className="mt-3">
        {loading && <p role="status" className="py-3 text-sm text-slate-500">Đang tải danh sách học sinh…</p>}
        {!loading && error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <span>{error}</span>
            <button type="button" onClick={onRetry} className="ml-3 font-semibold text-blue-700 hover:underline">
              Thử lại
            </button>
          </div>
        )}
        {!loading && !error && students.length === 0 && (
          <p role="status" className="py-3 text-sm text-slate-500">Lớp này chưa có học sinh.</p>
        )}
        {!loading && !error && students.length > 0 && filteredStudents.length === 0 && (
          <p role="status" className="py-3 text-sm text-slate-500">Không tìm thấy học sinh phù hợp.</p>
        )}
        {!loading && !error && filteredStudents.length > 0 && (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredStudents.map((student) => {
              const checked = selected.has(student.id);
              return (
                <label
                  key={student.id}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 py-2 transition-colors ${
                    checked ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type={selectionMode === 'STUDENT' ? 'radio' : 'checkbox'}
                    name={selectionMode === 'STUDENT' ? 'coin-award-student' : undefined}
                    aria-label={`Chọn ${student.fullName}`}
                    checked={checked}
                    onChange={() => {
                      if (selectionMode === 'STUDENT') {
                        onSelectionChange([student.id]);
                        return;
                      }
                      const next = new Set(selectedStudentIds);
                      if (next.has(student.id)) next.delete(student.id);
                      else next.add(student.id);
                      onSelectionChange(Array.from(next));
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{student.fullName}</span>
                    <span className="block truncate text-xs text-slate-500">{student.username}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
