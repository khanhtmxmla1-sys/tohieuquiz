import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import type { LoginMediaAdminSlide } from '../loginMediaAdmin.types';
import { formatSystemDateTime } from '../../../utils/dateTime';

interface Props {
  slides: LoginMediaAdminSlide[];
  busy: boolean;
  onEdit: (slide: LoginMediaAdminSlide) => void;
  onDelete: (slide: LoginMediaAdminSlide) => void;
  onReorder: (slideIds: string[]) => void;
  onPreview: (slide: LoginMediaAdminSlide) => void;
}

const scheduleLabel = (slide: LoginMediaAdminSlide): string => {
  const now = Date.now();
  if (!slide.enabled) return 'Đang tắt';
  if (slide.startsAt && Date.parse(slide.startsAt) > now) return `Bắt đầu ${formatSystemDateTime(slide.startsAt)}`;
  if (slide.endsAt && Date.parse(slide.endsAt) <= now) return 'Đã hết lịch';
  if (slide.endsAt) return `Hiển thị đến ${formatSystemDateTime(slide.endsAt)}`;
  return 'Đang có hiệu lực';
};

export const LoginMediaSlideList = ({ slides, busy, onEdit, onDelete, onReorder, onPreview }: Props) => {
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= slides.length) return;
    const ids = slides.map((slide) => slide.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    onReorder(ids);
  };

  if (slides.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Chưa có banner nào. Hãy tải ảnh đầu tiên.</div>;
  }

  return (
    <div className="space-y-3">
      {slides.map((slide, index) => (
        <article key={slide.id} data-testid={`login-media-slide-${slide.id}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center">
          <button type="button" onClick={() => onPreview(slide)} className="shrink-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" aria-label={`Xem trước ${slide.internalTitle || 'banner'}`}>
            <img src={slide.imageUrl} alt="" className="h-20 w-full object-cover sm:w-36" loading="lazy" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-bold text-slate-900">{slide.internalTitle || 'Banner chưa đặt tên'}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${slide.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{slide.enabled ? 'Bật' : 'Tắt'}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{scheduleLabel(slide)}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{slide.cloudinaryPublicId}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Chuyển ${slide.internalTitle || 'banner'} lên`} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30"><ArrowUp aria-hidden="true" className="size-4" /></button>
            <button type="button" disabled={busy || index === slides.length - 1} onClick={() => move(index, 1)} aria-label={`Chuyển ${slide.internalTitle || 'banner'} xuống`} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30"><ArrowDown aria-hidden="true" className="size-4" /></button>
            <button type="button" disabled={busy} onClick={() => onEdit(slide)} aria-label={`Sửa ${slide.internalTitle || 'banner'}`} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-blue-700"><Pencil aria-hidden="true" className="size-4" /></button>
            <button type="button" disabled={busy} onClick={() => onDelete(slide)} aria-label={`Xóa ${slide.internalTitle || 'banner'}`} className="grid size-11 place-items-center rounded-xl border border-red-200 text-red-600"><Trash2 aria-hidden="true" className="size-4" /></button>
          </div>
        </article>
      ))}
    </div>
  );
};
