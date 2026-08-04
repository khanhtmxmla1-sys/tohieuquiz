import React, { useEffect, useMemo, useState } from 'react';

export interface SafeSvgDiagramProps {
  svgContent: string;
  alt: string;
  className?: string;
  maxHeight?: number;
}

const SafeSvgDiagram: React.FC<SafeSvgDiagramProps> = ({
  svgContent,
  alt,
  className = '',
  maxHeight = 420,
}) => {
  const [hasError, setHasError] = useState(false);
  const source = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`,
    [svgContent],
  );
  const aspectRatio = useMemo(() => {
    const viewBox = svgContent.match(/\bviewBox\s*=\s*["']\s*[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?[\s,]+[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?[\s,]+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)[\s,]+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)["']/i);
    const width = Number(viewBox?.[1]);
    const height = Number(viewBox?.[2]);
    return width > 0 && height > 0 ? `${width} / ${height}` : undefined;
  }, [svgContent]);

  useEffect(() => setHasError(false), [source]);

  const handleRenderError = () => {
    console.info(JSON.stringify({
      event: 'svg_render_error',
      sizeBytes: new TextEncoder().encode(svgContent).byteLength,
    }));
    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        role="status"
        className={`flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 ${className}`}
      >
        Không thể hiển thị hình minh họa.
      </div>
    );
  }

  return (
    <figure
      className={`flex w-full min-w-0 justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-4 ${className}`}
    >
      <img
        src={source}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={handleRenderError}
        className="block h-auto w-full max-w-full object-contain"
        style={{ maxHeight, aspectRatio }}
      />
    </figure>
  );
};

export default React.memo(SafeSvgDiagram);
