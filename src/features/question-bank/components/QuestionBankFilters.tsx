import { Search } from 'lucide-react';
import { QuestionType } from '../../../types';
import type { QuestionBankFilters as Filters } from '../questionBank.types';
import {
  QUESTION_BANK_LESSON_OPTIONS,
  QUESTION_BANK_TOPIC_OPTIONS,
} from '../questionBank.catalog';

interface QuestionBankFiltersProps {
  value: Filters;
  onChange: (value: Filters) => void;
  showStatus?: boolean;
}

const questionTypes = Object.values(QuestionType);

export const QuestionBankFilters = ({ value, onChange, showStatus = false }: QuestionBankFiltersProps) => {
  const patch = (next: Partial<Filters>) => onChange({ ...value, ...next, page: 1 });

  return (
    <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="relative sm:col-span-2 xl:col-span-1">
        <span className="sr-only">Tìm trong ngân hàng câu hỏi</span>
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="search"
          aria-label="Tìm trong ngân hàng câu hỏi"
          value={value.search}
          onChange={(event) => patch({ search: event.target.value })}
          placeholder="Tìm nội dung câu hỏi…"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500"
        />
      </label>
      <select aria-label="Lọc theo lớp" value={value.grade ?? ''} onChange={(event) => patch({ grade: event.target.value ? Number(event.target.value) : undefined })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">Tất cả lớp</option>
        {[1, 2, 3, 4, 5].map((grade) => <option key={grade} value={grade}>Lớp {grade}</option>)}
      </select>
      <select aria-label="Lọc theo môn" value={value.subject ?? ''} onChange={(event) => patch({ subject: event.target.value || undefined })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">Tất cả môn</option>
        <option value="MATH">Toán</option>
        <option value="VIETNAMESE">Tiếng Việt</option>
      </select>
      <select aria-label="Lọc theo học kì" value={value.semester ?? ''} onChange={(event) => patch({ semester: event.target.value ? Number(event.target.value) : undefined })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">Mọi học kì</option>
        <option value="1">Học kì 1</option>
        <option value="2">Học kì 2</option>
      </select>
      <select aria-label="Lọc theo chủ đề" value={value.topicCode ?? ''} onChange={(event) => patch({ topicCode: event.target.value || undefined })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">Tất cả chủ đề</option>
        {QUESTION_BANK_TOPIC_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select>
      <select aria-label="Lọc theo bài" value={value.lessonCode ?? ''} onChange={(event) => patch({ lessonCode: event.target.value || undefined })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">Tất cả bài</option>
        {QUESTION_BANK_LESSON_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select>
      <select aria-label="Lọc theo dạng câu hỏi" value={value.type ?? ''} onChange={(event) => patch({ type: event.target.value ? event.target.value as QuestionType : undefined })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">Tất cả dạng</option>
        {questionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <select aria-label="Lọc theo độ khó" value={value.difficulty ?? ''} onChange={(event) => patch({ difficulty: event.target.value ? Number(event.target.value) as 1 | 2 | 3 : undefined })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="">Mọi độ khó</option>
        <option value="1">Dễ</option>
        <option value="2">Trung bình</option>
        <option value="3">Khó</option>
      </select>
      {showStatus && (
        <select aria-label="Lọc theo trạng thái" value={value.status ?? ''} onChange={(event) => patch({ status: event.target.value ? event.target.value as Filters['status'] : undefined })} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <option value="">Mọi trạng thái</option>
          <option value="DRAFT">Bản nháp</option>
          <option value="PUBLISHED">Đã phát hành</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
      )}
    </div>
  );
};
