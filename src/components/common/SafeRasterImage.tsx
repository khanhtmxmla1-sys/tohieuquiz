import React, { useEffect, useState } from 'react';

interface SafeRasterImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
    src: string;
    alt: string;
    fallbackClassName?: string;
}

const SafeRasterImage: React.FC<SafeRasterImageProps> = ({
    src,
    alt,
    className = '',
    fallbackClassName = '',
    ...imageProps
}) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => setHasError(false), [src]);

    if (hasError) {
        return (
            <div
                role="status"
                className={`flex min-h-24 w-full items-center justify-center rounded-[10px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500 ${fallbackClassName}`}
            >
                Không thể hiển thị hình ảnh.
            </div>
        );
    }

    return (
        <img
            {...imageProps}
            src={src}
            alt={alt}
            className={className}
            onError={(event) => {
                imageProps.onError?.(event);
                setHasError(true);
            }}
        />
    );
};

export default React.memo(SafeRasterImage);
