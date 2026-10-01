import { Image as ImageIcon } from 'lucide-react';
import { useMemo } from 'react';
import LoginMediaCarousel from '../../../components/HomePage/components/login-media/LoginMediaCarousel';
import type { LoginMediaPublicSlide } from '../../../components/HomePage/components/login-media/loginMedia.types';
import type { LoginMediaAdminSettings, LoginMediaAdminSlide } from '../loginMediaAdmin.types';

export type LoginMediaPreviewSlide = Pick<
  LoginMediaAdminSlide,
  'id' | 'imageUrl' | 'imageWidth' | 'imageHeight' | 'altText'
  | 'cropX' | 'cropY' | 'cropZoom' | 'linkUrl' | 'openNewTab'
>;

interface Props {
  settings: LoginMediaAdminSettings;
  slides: LoginMediaPreviewSlide[];
  selectedSlideId?: string | null;
}

export const LoginMediaPreview = ({ settings, slides, selectedSlideId = null }: Props) => {
  const previewSlides = useMemo<LoginMediaPublicSlide[]>(() => slides.map((slide) => ({
    id: slide.id,
    imageUrl: slide.imageUrl,
    imageWidth: slide.imageWidth,
    imageHeight: slide.imageHeight,
    alt: slide.altText,
    cropX: slide.cropX,
    cropY: slide.cropY,
    cropZoom: slide.cropZoom,
    linkUrl: slide.linkUrl,
    openNewTab: slide.openNewTab,
  })), [slides]);

  const showSlider = settings.displayMode === 'SLIDER' && previewSlides.length > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="login-media-preview-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="login-media-preview-title" className="text-lg font-bold text-slate-900">Xem trước</h3>
          <p className="text-xs text-slate-500">Khung mô phỏng khu vực desktop bên trái trang đăng nhập.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {settings.displayMode === 'SLIDER' ? 'Trình chiếu ảnh' : 'Tổng quan học tập'}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-[#dce5f1] bg-white shadow-[0_22px_54px_-44px_rgba(30,58,138,0.42)]">
        {showSlider ? (
          <LoginMediaCarousel
            slides={previewSlides}
            settings={settings}
            selectedSlideId={selectedSlideId}
            allowLinks={false}
          />
        ) : (
          <div className="flex aspect-[630/286] items-center justify-center text-center text-slate-500">
            <div>
              <ImageIcon aria-hidden="true" className="mx-auto mb-2 size-8" />
              <p className="font-semibold">Tổng quan học tập</p>
              <p className="mt-1 text-xs">Nội dung mặc định sẽ được hiển thị.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
