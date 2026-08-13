import { useEffect, useMemo, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { showError } from '../../../utils/toast';
import { systemDateTimeLocalToIso, toSystemDateTimeLocal } from '../../../utils/dateTime';
import type {
  LoginMediaAdminSlide,
  LoginMediaSlideInput,
  LoginMediaUploadedImage,
} from '../loginMediaAdmin.types';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface Props {
  slide: LoginMediaAdminSlide | null;
  nextSortOrder: number;
  busy: boolean;
  onClose: () => void;
  onUpload: (file: File, onProgress: (percent: number) => void) => Promise<LoginMediaUploadedImage>;
  onSave: (input: LoginMediaSlideInput) => Promise<boolean>;
}

const localDate = (value: string | null): string => {
  if (!value) return '';
  try { return toSystemDateTimeLocal(value); } catch { return ''; }
};

const apiDate = (value: string): string | null => value ? systemDateTimeLocalToIso(value) : null;

export const LoginMediaSlideEditor = ({ slide, nextSortOrder, busy, onClose, onUpload, onSave }: Props) => {
  const [image, setImage] = useState<LoginMediaUploadedImage | null>(slide ? {
    secureUrl: slide.imageUrl,
    publicId: slide.cloudinaryPublicId,
    width: slide.imageWidth || 0,
    height: slide.imageHeight || 0,
  } : null);
  const [title, setTitle] = useState(slide?.internalTitle || '');
  const [alt, setAlt] = useState(slide?.altText || '');
  const [linkUrl, setLinkUrl] = useState(slide?.linkUrl || '');
  const [openNewTab, setOpenNewTab] = useState(slide?.openNewTab || false);
  const [enabled, setEnabled] = useState(slide?.enabled || false);
  const [startsAt, setStartsAt] = useState(localDate(slide?.startsAt || null));
  const [endsAt, setEndsAt] = useState(localDate(slide?.endsAt || null));
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setImage(slide ? {
      secureUrl: slide.imageUrl,
      publicId: slide.cloudinaryPublicId,
      width: slide.imageWidth || 0,
      height: slide.imageHeight || 0,
    } : null);
    setTitle(slide?.internalTitle || '');
    setAlt(slide?.altText || '');
    setLinkUrl(slide?.linkUrl || '');
    setOpenNewTab(slide?.openNewTab || false);
    setEnabled(slide?.enabled || false);
    setStartsAt(localDate(slide?.startsAt || null));
    setEndsAt(localDate(slide?.endsAt || null));
    setProgress(0);
  }, [slide]);

  const previewAlt = useMemo(() => alt.trim() || 'Xem trước banner đang chỉnh sửa', [alt]);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      showError('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showError('Ảnh banner không được vượt quá 5 MB.');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const uploaded = await onUpload(file, setProgress);
      setImage(uploaded);
      setProgress(100);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể tải ảnh lên Cloudinary.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!image) {
      showError('Hãy chọn và tải ảnh banner trước khi lưu.');
      return;
    }
    if (linkUrl.trim() && !alt.trim()) {
      showError('Banner có liên kết phải có mô tả ảnh để hỗ trợ truy cập.');
      return;
    }
    let starts: string | null;
    let ends: string | null;
    try {
      starts = apiDate(startsAt);
      ends = apiDate(endsAt);
    } catch {
      showError('Lịch hiển thị không hợp lệ.');
      return;
    }
    if (starts && ends && Date.parse(starts) >= Date.parse(ends)) {
      showError('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
      return;
    }
    const ok = await onSave({
      cloudinaryPublicId: image.publicId,
      imageUrl: image.secureUrl,
      imageWidth: image.width || null,
      imageHeight: image.height || null,
      altText: alt.trim(),
      internalTitle: title.trim(),
      linkUrl: linkUrl.trim() || null,
      openNewTab: Boolean(linkUrl.trim()) && openNewTab,
      sortOrder: slide?.sortOrder ?? nextSortOrder,
      enabled,
      startsAt: starts,
      endsAt: ends,
    });
    if (ok) onClose();
  };

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5" aria-labelledby="login-media-editor-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="login-media-editor-title" className="text-lg font-bold text-slate-900">{slide ? 'Chỉnh sửa banner' : 'Thêm banner'}</h3>
          <p className="text-xs text-slate-500">Ảnh được tải trực tiếp lên Cloudinary bằng chữ ký ngắn hạn do Worker cấp.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng trình chỉnh sửa banner" className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white"><X aria-hidden="true" className="size-4" /></button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Chọn ảnh banner
            <input aria-label="Chọn ảnh banner" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || busy} onChange={(event) => void chooseFile(event.target.files?.[0])} className="mt-2 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:font-semibold file:text-white" />
          </label>
          <p className="mt-2 text-xs text-slate-500">JPEG, PNG hoặc WebP · tối đa 5 MB.</p>
          {(uploading || progress > 0) && <div className="mt-3" role="status"><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 transition-[width]" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-slate-500">{uploading ? `Đang tải ${progress}%` : 'Tải ảnh hoàn tất'}</p></div>}
          <div className="mt-4 flex aspect-[630/286] items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
            {image ? <img src={image.secureUrl} alt={previewAlt} className="h-full w-full object-cover" /> : <div className="text-center text-slate-400"><UploadCloud aria-hidden="true" className="mx-auto size-8" /><p className="mt-2 text-sm">Chưa có ảnh</p></div>}
          </div>
        </div>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Tên nội bộ<input aria-label="Tên nội bộ" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal" placeholder="Ví dụ: Banner tuyển sinh tháng 8" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Mô tả ảnh<input aria-label="Mô tả ảnh" maxLength={300} value={alt} onChange={(event) => setAlt(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal" placeholder="Nội dung chính của banner" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Liên kết khi nhấn<input aria-label="Liên kết khi nhấn" maxLength={2048} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal" placeholder="/practice hoặc https://..." /></label>
          <label className="text-sm font-semibold text-slate-700">Bắt đầu<input aria-label="Bắt đầu" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-700">Kết thúc<input aria-label="Kết thúc" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal" /></label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Bật hiển thị</label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium"><input type="checkbox" checked={openNewTab} disabled={!linkUrl.trim()} onChange={(event) => setOpenNewTab(event.target.checked)} /> Mở tab mới</label>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy || uploading || !image} onClick={() => void submit()} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu banner'}</button>
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700">Hủy</button>
          </div>
        </div>
      </div>
    </section>
  );
};
