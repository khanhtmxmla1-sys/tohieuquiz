import React from 'react';
import { Search } from 'lucide-react';
import type { ResultReportCohortReadyItem, ResultReportDraftInput } from '../../../../../shared/result-reports.contract';
import type { ResultReportCommentStyle } from '../../hooks/useResultReportDelivery';
import type { ResultReportReviewFilter } from '../../model/resultReportDelivery';
import { StudentReportPreview } from './StudentReportPreview';

interface ReviewStepProps {
  items: ResultReportCohortReadyItem[];
  allCount: number;
  selectedResultIds: Set<string>;
  selectedCount: number;
  activeItem: ResultReportCohortReadyItem | null;
  activeDraft: ResultReportDraftInput | null;
  className: string;
  quizTitle: string;
  teacherName: string;
  style: ResultReportCommentStyle;
  query: string;
  filter: ResultReportReviewFilter;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: ResultReportReviewFilter) => void;
  onStyleChange: (value: ResultReportCommentStyle) => void;
  onSelectAll: (selected: boolean) => void;
  onToggle: (resultId: string) => void;
  onActivate: (resultId: string) => void;
  onDraftChange: (resultId: string, patch: Partial<ResultReportDraftInput>) => void;
  onRegenerate: (resultId: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = (props) => (
  <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="result-report-review-heading">
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(310px,0.8fr)_minmax(480px,1.2fr)]">
      <aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r sm:p-5">
        <div>
          <h3 id="result-report-review-heading" className="text-lg font-semibold text-slate-900">Kiểm tra phiếu</h3>
          <p className="mt-1 text-sm text-slate-600">Chọn học sinh và kiểm tra nhận xét trước khi gửi.</p>
        </div>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={props.query}
              onChange={(event) => props.onQueryChange(event.target.value)}
              placeholder="Tìm học sinh trong danh sách..."
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-500"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={props.allCount > 0 && props.selectedCount === props.allCount}
                onChange={(event) => props.onSelectAll(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Chọn tất cả
            </label>
            <select
              aria-label="Lọc danh sách phiếu"
              value={props.filter}
              onChange={(event) => props.onFilterChange(event.target.value as ResultReportReviewFilter)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="all">Tất cả</option>
              <option value="selected">Đã chọn</option>
              <option value="unselected">Chưa chọn</option>
            </select>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            Phong cách nhận xét chung
            <select
              aria-label="Phong cách nhận xét chung"
              value={props.style}
              onChange={(event) => props.onStyleChange(event.target.value as ResultReportCommentStyle)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
            >
              <option value="nhe_nhang">Nhẹ nhàng</option>
              <option value="nghiem_tuc">Nghiêm túc</option>
              <option value="vui_ve">Vui vẻ</option>
            </select>
          </label>
        </div>

        <div data-testid="result-report-student-list" className="mt-4 max-h-[44vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[55vh]">
          {props.items.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Không có học sinh phù hợp bộ lọc.</p>}
          {props.items.map((item) => {
            const selected = props.selectedResultIds.has(item.result.id);
            const active = props.activeItem?.result.id === item.result.id;
            return (
              <div key={item.result.id} className={`flex items-start gap-3 rounded-xl border p-3 ${active ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                <input
                  type="checkbox"
                  aria-label={`Chọn ${item.student.fullName}`}
                  checked={selected}
                  onChange={() => props.onToggle(item.result.id)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => props.onActivate(item.result.id)}
                  className="min-h-11 min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold text-slate-900">{item.student.fullName}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{item.result.score}/10</span>
                    <span>Lần {item.attemptCount}</span>
                    <span>{selected ? 'Sẵn sàng' : 'Đã bỏ chọn'}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
        {props.activeItem && props.activeDraft ? (
          <StudentReportPreview
            item={props.activeItem}
            draft={props.activeDraft}
            className={props.className}
            quizTitle={props.quizTitle}
            teacherName={props.teacherName}
            onChange={(patch) => props.onDraftChange(props.activeItem!.result.id, patch)}
            onRegenerate={() => props.onRegenerate(props.activeItem!.result.id)}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chọn một học sinh để xem trước phiếu.</div>
        )}
      </div>
    </div>

    <div data-testid="result-report-review-actions" className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
      <button type="button" onClick={props.onBack} className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold text-slate-700">Quay lại</button>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-700">Sẽ gửi {props.selectedCount} phiếu</span>
        <button
          type="button"
          onClick={props.onContinue}
          disabled={props.selectedCount === 0}
          className="min-h-11 rounded-lg bg-sky-600 px-5 font-semibold text-white disabled:opacity-50"
        >
          Tiếp tục chọn cách gửi
        </button>
      </div>
    </div>
  </section>
);
