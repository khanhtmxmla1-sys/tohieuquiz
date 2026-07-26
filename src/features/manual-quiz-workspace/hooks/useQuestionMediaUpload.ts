import { useCallback, useState } from 'react';
import {
    compressImageForUpload,
    uploadToCloudinary,
} from '../../../services/cloudinaryService';

export const MAX_QUESTION_IMAGE_BYTES = 10 * 1024 * 1024;
export const QUESTION_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const validateQuestionImage = (file: File): string | null => {
    if (!QUESTION_IMAGE_MIME_TYPES.includes(file.type as (typeof QUESTION_IMAGE_MIME_TYPES)[number])) {
        return 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.';
    }
    if (file.size > MAX_QUESTION_IMAGE_BYTES) {
        return 'Ảnh phải nhỏ hơn hoặc bằng 10 MB.';
    }
    return null;
};

export const sanitizeImageAltText = (value: string): string => value
    .replace(/\\u00(?:0[0-9a-f]|1[0-9a-f])/gi, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);

interface UseQuestionMediaUploadOptions {
    onUploaded: (url: string) => void;
}

export const useQuestionMediaUpload = ({ onUploaded }: UseQuestionMediaUploadOptions) => {
    const [status, setStatus] = useState<'idle' | 'compressing' | 'uploading' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [lastFile, setLastFile] = useState<File | null>(null);

    const uploadFile = useCallback(async (file: File) => {
        const validationError = validateQuestionImage(file);
        if (validationError) {
            setLastFile(null);
            setStatus('error');
            setProgress(0);
            setError(validationError);
            return;
        }

        setLastFile(file);
        setError(null);
        setStatus('compressing');
        setProgress(0);

        try {
            const compressed = await compressImageForUpload(file, {
                onProgress: (value) => setProgress(Math.min(30, Math.round(value * 0.3))),
            });
            setStatus('uploading');
            setProgress(30);
            const url = await uploadToCloudinary(compressed, {
                onProgress: (value) => setProgress(Math.min(100, 30 + Math.round(value))),
            });
            onUploaded(url);
            setProgress(100);
            setStatus('idle');
            setError(null);
        } catch (uploadError) {
            setStatus('error');
            setError(uploadError instanceof Error ? uploadError.message : 'Không thể tải ảnh lên.');
        }
    }, [onUploaded]);

    const retry = useCallback(() => {
        if (lastFile) void uploadFile(lastFile);
    }, [lastFile, uploadFile]);

    const reset = useCallback(() => {
        setStatus('idle');
        setProgress(0);
        setError(null);
        setLastFile(null);
    }, []);

    return {
        status,
        progress,
        error,
        canRetry: Boolean(lastFile),
        uploadFile,
        retry,
        reset,
    };
};
