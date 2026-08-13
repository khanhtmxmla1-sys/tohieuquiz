import { Image as ImageIcon } from 'lucide-react';
import type { LoginMediaAdminSettings, LoginMediaAdminSlide } from '../loginMediaAdmin.types';

interface Props {
  settings: LoginMediaAdminSettings;
  slide: LoginMediaAdminSlide | null;
}

export const LoginMediaPreview = ({ settings, slide }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="login-media-preview-title">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 id="login-media-preview-title" className="text-lg font-bold text-slate-900">Xem trước</h3>
        <p className="text-xs text-slate-500">Khung mô phỏng khu vực desktop bên trái trang đăng nhập.</p>
      </div>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{settings.displayMode === 'SLIDER' ? 'Trình chiếu ảnh' : 'Tổng quan học tập'}</span>
    </div>
    <div className="mt-4 flex aspect-[630/286] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {settings.displayMode === 'SLIDER' && slide ? (
        <img src={slide.imageUrl} alt={slide.altText || 'Xem trước banner đăng nhập'} className="h-full w-full object-cover" />
      ) : (
        <div className="text-center text-slate-500"><ImageIcon aria-hidden="true" className="mx-auto mb-2 size-8" /><p className="font-semibold">Tổng quan học tập</p><p className="mt-1 text-xs">Nội dung mặc định sẽ được hiển thị.</p></div>
      )}
    </div>
  </section>
);
