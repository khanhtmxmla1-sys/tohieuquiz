import React from 'react';
import SafeRasterImage from './SafeRasterImage';
import SafeSvgDiagram from './SafeSvgDiagram';

const GeometryRenderer = React.lazy(() => import('./GeometryRenderer'));

interface QuestionMediaProps {
    question: unknown;
    className?: string;
    showOptionImages?: boolean;
}

const QuestionMedia: React.FC<QuestionMediaProps> = ({
    question,
    className = '',
    showOptionImages = true,
}) => {
    const record = question && typeof question === 'object'
        ? question as Record<string, unknown>
        : {};
    const image = typeof record.image === 'string' ? record.image.trim() : '';
    const imageAlt = typeof record.imageAlt === 'string'
        ? record.imageAlt.trim()
        : (typeof record.image_alt === 'string' ? record.image_alt.trim() : 'Hình minh họa câu hỏi');
    const svgContent = typeof record.svgContent === 'string'
        ? record.svgContent
        : (typeof record.svg_content === 'string' ? record.svg_content : '');
    const svgAlt = typeof record.svgAlt === 'string'
        ? record.svgAlt
        : (typeof record.svg_alt === 'string' ? record.svg_alt : '');
    const geometryData = record.geometryData && typeof record.geometryData === 'object'
        ? record.geometryData
        : null;
    const options = Array.isArray(record.options) ? record.options : [];
    const optionImages = showOptionImages && Array.isArray(record.optionImages)
        ? record.optionImages.map((value) => String(value ?? '').trim())
        : [];
    const visibleOptionImages = optionImages
        .map((src, index) => ({ src, index }))
        .filter((item) => Boolean(item.src));

    if (!image && !(svgContent && svgAlt) && !geometryData && visibleOptionImages.length === 0) {
        return null;
    }

    return (
        <section className={`space-y-3 ${className}`} aria-label="Hình minh họa câu hỏi">
            {image ? (
                <SafeRasterImage
                    src={image}
                    alt={imageAlt || 'Hình minh họa câu hỏi'}
                    loading="lazy"
                    decoding="async"
                    className="mx-auto block max-h-80 max-w-full rounded-[10px] border border-slate-200 bg-white object-contain"
                />
            ) : null}

            {svgContent && svgAlt && !geometryData ? (
                <SafeSvgDiagram svgContent={svgContent} alt={svgAlt} maxHeight={360} />
            ) : null}

            {geometryData ? (
                <div className="flex w-full min-w-0 justify-center overflow-x-auto rounded-[10px] border border-slate-200 bg-white p-3">
                    <React.Suspense
                        fallback={(
                            <div role="status" className="py-6 text-sm text-slate-500">
                                Đang tải hình học...
                            </div>
                        )}
                    >
                        <GeometryRenderer data={geometryData as any} />
                    </React.Suspense>
                </div>
            ) : null}

            {visibleOptionImages.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {visibleOptionImages.map(({ src, index }) => {
                        const label = String.fromCharCode(65 + index);
                        const option = options[index];
                        const optionText = typeof option === 'string'
                            ? option
                            : String((option as Record<string, unknown> | undefined)?.text ?? '');
                        return (
                            <figure key={`${src}-${index}`} className="min-w-0 rounded-[10px] border border-slate-200 bg-white p-2">
                                <SafeRasterImage
                                    src={src}
                                    alt={`Đáp án ${label}${optionText ? `: ${optionText}` : ''}`}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-36 w-full rounded-[8px] bg-slate-50 object-contain"
                                />
                                <figcaption className="mt-2 text-center text-xs font-semibold text-slate-600">
                                    Đáp án {label}
                                </figcaption>
                            </figure>
                        );
                    })}
                </div>
            ) : null}
        </section>
    );
};

export default React.memo(QuestionMedia);
