import { useRef } from 'react';
import LoginMediaImageViewport, {
  resolveLoginMediaCropLayout,
} from '../../../components/HomePage/components/login-media/LoginMediaImageViewport';

export interface LoginMediaCropValue {
  cropX: number;
  cropY: number;
  cropZoom: number;
}

interface Props extends LoginMediaCropValue {
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  alt: string;
  onChange: (value: LoginMediaCropValue) => void;
}

interface DragState {
  pointerId: number;
  clientX: number;
  clientY: number;
  cropX: number;
  cropY: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const roundCrop = (value: number): number => Math.round(value * 10_000) / 10_000;

export const LoginMediaCropEditor = ({
  imageUrl,
  imageWidth,
  imageHeight,
  alt,
  cropX,
  cropY,
  cropZoom,
  onChange,
}: Props) => {
  const dragRef = useRef<DragState | null>(null);

  const startDrag: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      cropX,
      cropY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDrag: React.PointerEventHandler<HTMLDivElement> = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const layout = resolveLoginMediaCropLayout(
      imageWidth,
      imageHeight,
      drag.cropX,
      drag.cropY,
      cropZoom,
    );
    const widthFactor = layout?.widthFactor || cropZoom;
    const heightFactor = layout?.heightFactor || cropZoom;

    const nextX = roundCrop(clamp(
      drag.cropX - ((event.clientX - drag.clientX) / (rect.width * widthFactor)),
      0,
      1,
    ));
    const nextY = roundCrop(clamp(
      drag.cropY - ((event.clientY - drag.clientY) / (rect.height * heightFactor)),
      0,
      1,
    ));
    onChange({ cropX: nextX, cropY: nextY, cropZoom });
    event.preventDefault();
  };

  const endDrag: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <section className="mt-4" aria-labelledby="login-media-crop-title">
      <h4 id="login-media-crop-title" className="text-sm font-bold text-slate-800">Căn chỉnh ảnh banner</h4>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Kéo ảnh để chọn vùng hiển thị. Phần bạn nhìn thấy trong khung này sẽ xuất hiện như vậy trên trang đăng nhập.
      </p>

      <div
        data-testid="login-media-crop-viewport"
        className="relative mt-3 aspect-[630/286] cursor-grab touch-none overflow-hidden rounded-xl border border-slate-300 bg-slate-100 active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <LoginMediaImageViewport
          imageUrl={imageUrl}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          alt={alt}
          cropX={cropX}
          cropY={cropY}
          cropZoom={cropZoom}
          imageClassName="pointer-events-none"
        />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/40" />
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-700">
        Phóng to ảnh
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">100%</span>
          <input
            aria-label="Phóng to ảnh"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={cropZoom}
            onChange={(event) => onChange({
              cropX,
              cropY,
              cropZoom: roundCrop(clamp(Number(event.target.value), 1, 3)),
            })}
            className="min-h-11 flex-1"
          />
          <span className="w-12 text-right text-xs font-semibold text-slate-600">{Math.round(cropZoom * 100)}%</span>
        </div>
      </label>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Vị trí X {Math.round(cropX * 100)}% · Y {Math.round(cropY * 100)}%
        </p>
        <button
          type="button"
          onClick={() => onChange({ cropX: 0.5, cropY: 0.5, cropZoom: 1 })}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Đặt lại vị trí ảnh
        </button>
      </div>
    </section>
  );
};
