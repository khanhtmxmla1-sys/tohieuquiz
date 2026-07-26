import React from 'react';
import { Link2, Send, ShieldCheck, Sheet } from 'lucide-react';

interface DeliveryStepProps {
  className: string;
  quizTitle: string;
  selectedCount: number;
  skippedCount: number;
  notifyStudents: boolean;
  createParentLinks: boolean;
  prepareExternalList: boolean;
  isSubmitting: boolean;
  error: string | null;
  onNotifyStudentsChange: (value: boolean) => void;
  onCreateParentLinksChange: (value: boolean) => void;
  onPrepareExternalListChange: (value: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const OptionCard = ({
  checked, onChange, label, description, icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  icon: React.ReactNode;
}) => (
  <label className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-4 ${checked ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" aria-label={label} />
    <span className="mt-0.5 text-sky-700">{icon}</span>
    <span>
      <span className="block font-semibold text-slate-900">{label}</span>
      <span className="mt-1 block text-sm text-slate-600">{description}</span>
    </span>
  </label>
);

export const DeliveryStep: React.FC<DeliveryStepProps> = (props) => (
  <section className="space-y-5 px-4 py-5 sm:px-6" aria-labelledby="result-report-delivery-heading">
    <div>
      <h3 id="result-report-delivery-heading" className="text-lg font-semibold text-slate-900">Chọn cách gửi</h3>
      <p className="mt-1 text-sm text-slate-600">Mỗi học sinh và phụ huynh chỉ nhận đúng phiếu của mình.</p>
    </div>

    <div className="space-y-3">
      <OptionCard checked={props.notifyStudents} onChange={props.onNotifyStudentsChange} label="Gửi vào tài khoản học sinh" description="Học sinh nhận thông báo và xem phiếu sau khi đăng nhập." icon={<Send className="h-5 w-5" />} />
      <OptionCard checked={props.createParentLinks} onChange={props.onCreateParentLinksChange} label="Tạo link riêng cho phụ huynh" description="Mỗi học sinh có một link bảo mật riêng, mặc định hiệu lực 30 ngày." icon={<Link2 className="h-5 w-5" />} />
      <OptionCard checked={props.prepareExternalList} onChange={props.onPrepareExternalListChange} label="Chuẩn bị danh sách gửi Zalo/Excel" description="Sau khi tạo link, có thể sao chép tin nhắn hoặc xuất danh sách riêng tư." icon={<Sheet className="h-5 w-5" />} />
    </div>

    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>Không có link chung cho cả lớp. Link có thể thu hồi và không hiển thị kết quả của học sinh khác.</p></div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-semibold text-slate-900">Xác nhận phạm vi</h4>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Lớp</dt><dd className="font-semibold text-slate-900">Lớp {props.className.replace(/^Lớp\s+/i, '')}</dd></div>
        <div><dt className="text-slate-500">Bài kiểm tra</dt><dd className="font-semibold text-slate-900">{props.quizTitle}</dd></div>
        <div><dt className="text-slate-500">Phiếu sẽ gửi</dt><dd className="font-semibold text-slate-900">{props.selectedCount}</dd></div>
        <div><dt className="text-slate-500">Học sinh bỏ qua</dt><dd className="font-semibold text-slate-900">{props.skippedCount}</dd></div>
      </dl>
    </div>

    {props.error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{props.error}</p>}

    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <button type="button" onClick={props.onBack} disabled={props.isSubmitting} className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold text-slate-700">Quay lại</button>
      <button
        type="button"
        onClick={props.onSubmit}
        disabled={props.isSubmitting || (!props.notifyStudents && !props.createParentLinks)}
        className="min-h-11 rounded-lg bg-sky-600 px-5 font-semibold text-white disabled:opacity-50"
      >
        {props.isSubmitting ? 'Đang gửi...' : `Gửi ${props.selectedCount} phiếu kết quả`}
      </button>
    </div>
  </section>
);
