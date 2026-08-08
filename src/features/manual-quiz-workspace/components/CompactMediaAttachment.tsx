import React, { useId, useRef, useState } from 'react';
import { ChevronUp, ImagePlus, Link2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import {
    sanitizeImageAltText,
    useQuestionMediaUpload,
} from '../hooks/useQuestionMediaUpload';

interface CompactMediaAttachmentProps {
    label: string;
    value: string;
    altText?: string;
    onChange: (url: string) => void;
    onAltTextChange?: (value: string) => void;
}

const CompactMediaAttachment: React.FC<CompactMediaAttachmentProps> = ({
    label,
    value,
    altText = '',
    onChange,
    onAltTextChange,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const panelId = useId();
    const [expanded, setExpanded] = useState(Boolean(value));
    const [useUrl, setUseUrl] = useState(false);
    const [urlDraft, setUrlDraft] = useState('');
    const upload = useQuestionMediaUpload({
        onUploaded: (url) => {
            onChange(url);
            setExpanded(true);
            setUseUrl(false);
            setUrlDraft('');
        },
    });

    const chooseFile = (file?: File | null) => {
        if (!file) return;
        setExpanded(true);
        setUseUrl(false);
        void upload.uploadFile(file);
    };

    const remove = () => {
        onChange('');
        onAltTextChange?.('');
        upload.reset();
        setUseUrl(false);
        setUrlDraft('');
        setExpanded(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const applyUrl = () => {
        const next = urlDraft.trim();
        if (!next) return;
        onChange(next);
        upload.reset();
        setUseUrl(false);
        setExpanded(true);
    };

    const handlePaste = (event: React.ClipboardEvent<HTMLElement>) => {
        const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith('image/'));
        chooseFile(item?.getAsFile());
    };

    if (!expanded && !value) {
        return (
            <button
                type="button"
                aria-label="Thêm ảnh đính kèm"
                aria-expanded="false"
                aria-controls={panelId}
                onClick={() => setExpanded(true)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-left text-sm text-slate-600 transition hover:border-sky-400 hover:bg-sky-50"
            >
                <span className="inline-flex min-w-0 items-center gap-2">
                    <ImagePlus className="h-4 w-4 shrink-0 text-sky-600" />
                    <span className="truncate">Chưa có ảnh</span>
                </span>
                <span className="shrink-0 font-semibold text-sky-700">+ Thêm ảnh</span>
            </button>
        );
    }

    return (
        <section
            id={panelId}
            role="region"
            aria-label={`Tải ảnh ${label}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                chooseFile(event.dataTransfer.files?.[0]);
            }}
            onPaste={handlePaste}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <img
                        src={value}
                        alt={altText || label}
                        className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-white object-contain"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                        {onAltTextChange && (
                            <label className="block text-xs font-medium text-slate-700">
                                Mô tả ảnh
                                <input
                                    aria-label={`Mô tả ảnh ${label}`}
                                    value={altText}
                                    onChange={(event) => onAltTextChange(sanitizeImageAltText(event.target.value))}
                                    placeholder="Ví dụ: Hình vuông màu xanh"
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"
                                />
                            </label>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                aria-label={`Thay ảnh ${label}`}
                                onClick={() => inputRef.current?.click()}
                                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-sky-300"
                            >
                                <RefreshCw className="h-3.5 w-3.5" /> Thay ảnh
                            </button>
                            <button
                                type="button"
                                aria-label={`Dùng URL cho ${label}`}
                                onClick={() => {
                                    setUseUrl(true);
                                    setUrlDraft(value);
                                }}
                                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-sky-700 hover:border-sky-300"
                            >
                                <Link2 className="h-3.5 w-3.5" /> Dùng URL
                            </button>
                            <button
                                type="button"
                                aria-label={`Xóa ảnh ${label}`}
                                onClick={remove}
                                className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Xóa
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <button
                        type="button"
                        aria-label="Thêm ảnh đính kèm"
                        aria-expanded="true"
                        aria-controls={panelId}
                        onClick={() => {
                            setUseUrl(false);
                            setUrlDraft('');
                            setExpanded(false);
                        }}
                        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-2 text-sm text-slate-600 hover:bg-white"
                    >
                        <span className="inline-flex items-center gap-2 font-medium">
                            <ImagePlus className="h-4 w-4 text-sky-600" /> Ảnh đính kèm
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <ChevronUp className="h-3.5 w-3.5" /> Thu gọn
                        </span>
                    </button>
                    <button
                        type="button"
                        aria-label={`Chọn ảnh ${label}`}
                        onClick={() => inputRef.current?.click()}
                        className="flex min-h-24 w-full items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 text-center hover:border-sky-400 hover:bg-sky-50"
                    >
                        <UploadCloud className="h-6 w-6 shrink-0 text-sky-600" />
                        <span>
                            <span className="block text-sm font-semibold text-slate-800">Chọn, kéo thả hoặc dán ảnh</span>
                            <span className="mt-0.5 block text-xs text-slate-500">JPG, PNG, WebP · tối đa 10 MB</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        aria-label={`Dùng URL cho ${label}`}
                        onClick={() => setUseUrl(true)}
                        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-medium text-sky-700 hover:bg-sky-50"
                    >
                        <Link2 className="h-3.5 w-3.5" /> Dùng URL ảnh
                    </button>
                </div>
            )}

            {useUrl && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                        URL {label}
                        <input
                            aria-label={`URL ${label}`}
                            value={urlDraft}
                            onChange={(event) => setUrlDraft(event.target.value)}
                            placeholder="https://..."
                            className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={applyUrl}
                        disabled={!urlDraft.trim()}
                        className="mt-auto min-h-10 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Dùng URL này
                    </button>
                </div>
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
                            className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Thử lại
                        </button>
                    )}
                </div>
            )}
        </section>
    );
};

export default CompactMediaAttachment;
