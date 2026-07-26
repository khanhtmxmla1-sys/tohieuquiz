import { ChevronDown } from 'lucide-react';
import type { TemplateOption } from '../useBatches';

interface BatchIdentityFieldsProps {
  templates: TemplateOption[];
  templateId: string;
  setTemplateId: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  customNote: string;
  setCustomNote: (value: string) => void;
}

export const BatchIdentityFields = (props: BatchIdentityFieldsProps) => (
  <>
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">Mẫu chứng nhận</label>
      <div className="relative">
        <select
          value={props.templateId}
          onChange={event => props.setTemplateId(event.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {props.templates.length === 0 && <option value="">-- Chưa có mẫu nào --</option>}
          {props.templates.map(template => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">Tiêu đề đợt cấp</label>
      <input
        type="text"
        value={props.title}
        onChange={event => props.setTitle(event.target.value)}
        placeholder="Vd: Kết quả kỳ thi Toán tháng 6"
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        Ghi chú thêm <span className="font-normal text-slate-400">(tùy chọn)</span>
      </label>
      <input
        type="text"
        value={props.customNote}
        onChange={event => props.setCustomNote(event.target.value)}
        placeholder="Vd: Chúc mừng em đã hoàn thành xuất sắc!"
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </>
);
