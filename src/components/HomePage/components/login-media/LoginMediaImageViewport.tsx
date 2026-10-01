import React from 'react';

const FRAME_RATIO = 630 / 286;

interface Props {
  imageUrl: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  alt: string;
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
  imageClassName?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'auto' | 'sync';
  onError?: () => void;
}

export interface LoginMediaCropLayout {
  widthFactor: number;
  heightFactor: number;
  widthPercent: number;
  heightPercent: number;
  leftPercent: number;
  topPercent: number;
}

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
);

const round = (value: number): number => Math.round(value * 10_000) / 10_000;

export const resolveLoginMediaCropLayout = (
  imageWidth: number | null | undefined,
  imageHeight: number | null | undefined,
  cropX = 0.5,
  cropY = 0.5,
  cropZoom = 1,
): LoginMediaCropLayout | null => {
  if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) return null;

  const safeX = clamp(cropX, 0, 1);
  const safeY = clamp(cropY, 0, 1);
  const safeZoom = clamp(cropZoom, 1, 3);
  const imageRatio = imageWidth / imageHeight;

  const coverWidthFactor = imageRatio >= FRAME_RATIO ? imageRatio / FRAME_RATIO : 1;
  const coverHeightFactor = imageRatio >= FRAME_RATIO ? 1 : FRAME_RATIO / imageRatio;
  const widthFactor = coverWidthFactor * safeZoom;
  const heightFactor = coverHeightFactor * safeZoom;

  const left = clamp(0.5 - safeX * widthFactor, 1 - widthFactor, 0);
  const top = clamp(0.5 - safeY * heightFactor, 1 - heightFactor, 0);

  return {
    widthFactor,
    heightFactor,
    widthPercent: round(widthFactor * 100),
    heightPercent: round(heightFactor * 100),
    leftPercent: round(left * 100),
    topPercent: round(top * 100),
  };
};

const LoginMediaImageViewport: React.FC<Props> = ({
  imageUrl,
  imageWidth = null,
  imageHeight = null,
  alt,
  cropX = 0.5,
  cropY = 0.5,
  cropZoom = 1,
  imageClassName = '',
  loading = 'lazy',
  decoding = 'async',
  onError,
}) => {
  const layout = resolveLoginMediaCropLayout(
    imageWidth,
    imageHeight,
    cropX,
    cropY,
    cropZoom,
  );

  if (!layout) {
    const safeX = round(clamp(cropX, 0, 1) * 100);
    const safeY = round(clamp(cropY, 0, 1) * 100);
    return (
      <div className="relative h-full w-full overflow-hidden">
        <img
          src={imageUrl}
          alt={alt}
          draggable={false}
          loading={loading}
          decoding={decoding}
          onError={onError}
          className={`h-full w-full select-none object-cover ${imageClassName}`.trim()}
          style={{ objectPosition: `${safeX}% ${safeY}%` }}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <img
        src={imageUrl}
        alt={alt}
        draggable={false}
        loading={loading}
        decoding={decoding}
        onError={onError}
        className={`absolute max-w-none select-none ${imageClassName}`.trim()}
        style={{
          width: `${layout.widthPercent}%`,
          height: `${layout.heightPercent}%`,
          left: `${layout.leftPercent}%`,
          top: `${layout.topPercent}%`,
        }}
      />
    </div>
  );
};

export default LoginMediaImageViewport;
