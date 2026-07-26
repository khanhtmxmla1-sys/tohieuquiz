import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import {
    sanitizeImageAltText,
    useQuestionMediaUpload,
} from '../hooks/useQuestionMediaUpload';

interface MediaDropzoneProps {
    label: string;
    value: string;
    altText?: string;
    onChange: (url: string) => void;
    onAltTextChange?: (value: string) => void;
}

const MediaDropzone: React.FC<MediaDropzoneProps> = ({
    label,
    value,
    altText = '',
    onChange,
    onAltTextChange,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [useUrl, setUseUrl] = useState(false);
    const upload = useQuestionMediaUpload({
        onUploaded: (url) => {
            onChange(url);
            setUseUrl(false);
        },
    });

    const chooseFile = (file?: File | null) => {
        if (file) void upload.uploadFile(file);
    };

    const remove = () => {
        onChange('');
        onAltTextChange?.('');
        upload.reset();
        setUseUrl(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <section
            role="region"
            aria-label={`Tải ảnh ${label}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                chooseFile(event.dataTransfer.files?.[0]);
            }}
            onPaste={(event) => {
                const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith('image/'));
                chooseFile(item?.getAsFile());
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label={`Chọn ảnh ${label}`}
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0])}
            />

            {value ? (
                <div className="space-y-3">
                    <img
                        src={value}
                        alt={altText || label}
                        className="max-h-56 w-full rounded-xl border border-slate-200 bg-white object-contain"
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            aria-label={`Thay ảnh ${label}`}
                            onClick={() => inputRef.current?.click()}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium"
                        >
                            <RefreshCw className="h-4 w-4" /> Thay ảnh
                        </button>
                        <button
                            type="button"
                            aria-label={`Dùng URL cho ${label}`}
                            onClick={() => setUseUrl(true)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium"
                        >
                            <Link2 className="h-4 w-4" /> Dùng URL
                        </button>
                        <button
                            type="button"
                            aria-label={`Xóa ảnh ${label}`}
                            onClick={remove}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        >
                            <Trash2 className="h-4 w-4" /> Xóa ảnh
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center hover:border-sky-400 hover:bg-sky-50"
                >
                    <UploadCloud className="mb-2 h-7 w-7 text-sky-600" />
                    <span className="text-sm font-semibold text-slate-800">Chọn, kéo thả hoặc dán ảnh</span>
                    <span className="mt-1 text-xs text-slate-500">JPG, PNG, WebP · tối đa 10 MB</span>
                </button>
            )}

            {!useUrl && !value && (
                <button
                    type="button"
                    aria-label={`Dùng URL cho ${label}`}
                    onClick={() => setUseUrl(true)}
                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-sky-700 hover:bg-sky-50"
                >
                    <Link2 className="h-4 w-4" /> Hoặc dùng URL ảnh
                </button>
            )}

            {useUrl && (
                <label className="mt-3 block text-sm font-medium text-slate-700">
                    URL {label}
                    <input
                        aria-label={`URL ${label}`}
                        value={value}
                        onChange={(event) => onChange(event.target.value.trim())}
                        placeholder="https://..."
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-sky-500"
                    />
                </label>
            )}

            {(upload.status === 'compressing' || upload.status === 'uploading') && (
                <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                        <span>{upload.status === 'compressing' ? 'Đang nén ảnh…' : 'Đang tải ảnh…'}</span>
                        <span>{upload.progress}%</span>
                    </div>
                    <progress
                        aria-label={`Tiến độ tải ${label}`}
                        value={upload.progress}
                        max={100}
                        className="h-2 w-full"
                    />
                </div>
            )}

            {upload.error && (
                <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    <p>{upload.error}</p>
                    {upload.canRetry && (
                        <button
                            type="button"
                            aria-label={`Thử tải lại ${label}`}
                            onClick={upload.retry}
                            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 font-semibold"
                        >
                            <RefreshCw className="h-4 w-4" /> Thử lại
                        </button>
                    )}
                </div>
            )}

            {(value || onAltTextChange) && (
                <label className="mt-3 block text-sm font-medium text-slate-700">
                    Mô tả ảnh
                    <input
                        aria-label={`Mô tả ảnh ${label}`}
                        value={altText}
                        onChange={(event) => onAltTextChange?.(sanitizeImageAltText(event.target.value))}
                        placeholder="Ví dụ: Hình vuông màu xanh"
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-sky-500"
                    />
                </label>
            )}

            {!value && upload.status === 'idle' && !useUrl && (
                <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <ImagePlus className="h-4 w-4" /> Ảnh chỉ được lưu sau khi tải lên thành công.
                </p>
            )}
        </section>
    );
};

export default MediaDropzone;
