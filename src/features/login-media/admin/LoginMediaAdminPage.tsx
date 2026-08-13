import { Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LoginMediaAdminSlide, LoginMediaSlideInput } from '../loginMediaAdmin.types';
import { LoginMediaPreview } from './LoginMediaPreview';
import { LoginMediaSettingsCard } from './LoginMediaSettingsCard';
import { LoginMediaSlideEditor } from './LoginMediaSlideEditor';
import { LoginMediaSlideList } from './LoginMediaSlideList';
import { useLoginMediaAdmin } from './useLoginMediaAdmin';

const LoginMediaAdminPage = () => {
  const admin = useLoginMediaAdmin();
  const [editing, setEditing] = useState<LoginMediaAdminSlide | null | undefined>(undefined);
  const [preview, setPreview] = useState<LoginMediaAdminSlide | null>(null);

  const orderedSlides = useMemo(
    () => [...(admin.state?.slides || [])].sort((left, right) => left.sortOrder - right.sortOrder),
    [admin.state?.slides],
  );
  const selectedPreview = preview
    ? orderedSlides.find((slide) => slide.id === preview.id) || null
    : null;
  const previewSlide = selectedPreview
    || orderedSlides.find((slide) => slide.enabled)
    || orderedSlides[0]
    || null;
  const nextSortOrder = orderedSlides.length > 0
    ? Math.max(...orderedSlides.map((slide) => slide.sortOrder)) + 10
    : 10;

  const saveSlide = async (input: LoginMediaSlideInput): Promise<boolean> => {
    if (editing) {
      return admin.saveExistingSlide(editing.id, {
        ...input,
        expectedUpdatedAt: editing.updatedAt,
      });
    }
    return admin.saveNewSlide(input);
  };

  const deleteSlide = (slide: LoginMediaAdminSlide) => {
    if (!window.confirm(`Xóa “${slide.internalTitle || 'banner'}” khỏi danh sách? Ảnh trên Cloudinary sẽ không bị xóa.`)) return;
    void admin.remove(slide.id, slide.updatedAt);
  };

  if (admin.loading && !admin.state) {
    return (
      <div role="status" aria-label="Đang tải banner đăng nhập" className="mx-auto grid min-h-64 w-full max-w-[1440px] place-items-center text-sm text-slate-500">
        <span>Đang tải cấu hình banner đăng nhập…</span>
      </div>
    );
  }

  if (!admin.state) {
    return (
      <div className="mx-auto w-full max-w-[1440px] rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
        <p className="font-bold">Không thể tải Banner đăng nhập</p>
        <p className="mt-1">{admin.loadError || 'Dữ liệu chưa sẵn sàng.'}</p>
        <button type="button" onClick={() => void admin.reload()} className="mt-4 min-h-11 rounded-xl border border-red-200 bg-white px-4 font-semibold">Thử lại</button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Banner đăng nhập</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Quản lý hình ảnh truyền thông ở khu vực bên trái trang đăng nhập. Tắt trình chiếu để quay lại Tổng quan học tập ngay lập tức.
          </p>
        </div>
        <button type="button" disabled={admin.loading} onClick={() => void admin.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50">
          <RefreshCw aria-hidden="true" className={`size-4 ${admin.loading ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      <LoginMediaSettingsCard settings={admin.state.settings} busy={admin.busy} onSave={admin.saveSettings} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="login-media-slides-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="login-media-slides-title" className="text-lg font-bold text-slate-900">Danh sách banner</h3>
              <p className="text-xs text-slate-500">Tối đa 10 banner đang bật được gửi ra trang đăng nhập; có thể lưu thêm banner tắt để dùng sau.</p>
            </div>
            <button type="button" onClick={() => setEditing(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              <Plus aria-hidden="true" className="size-4" /> Thêm banner
            </button>
          </div>
          <LoginMediaSlideList
            slides={orderedSlides}
            busy={admin.busy}
            onEdit={(slide) => setEditing(slide)}
            onDelete={deleteSlide}
            onReorder={(ids) => void admin.reorder(ids)}
            onPreview={setPreview}
          />
        </section>
        <LoginMediaPreview settings={admin.state.settings} slide={previewSlide} />
      </div>

      {editing !== undefined && (
        <LoginMediaSlideEditor
          key={editing?.id || 'new'}
          slide={editing}
          nextSortOrder={nextSortOrder}
          busy={admin.busy}
          onClose={() => setEditing(undefined)}
          onUpload={admin.uploadImage}
          onSave={saveSlide}
        />
      )}
    </div>
  );
};

export default LoginMediaAdminPage;
