import imageCompression from 'browser-image-compression';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || '';

export interface UploadProgressOptions {
    onProgress?: (value: number) => void;
}

export interface CloudinaryResponse {
    secure_url: string;
    public_id: string;
}

interface CloudinaryErrorResponse {
    error?: { message?: string };
}

export const compressImageForUpload = async (
    file: File,
    options: UploadProgressOptions = {},
): Promise<File> => imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: file.type,
    onProgress: options.onProgress,
});

export const uploadToCloudinary = async (
    file: File,
    options: UploadProgressOptions | number = {},
): Promise<string> => {
    const progressOptions = typeof options === 'object' ? options : {};
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error('Dịch vụ tải ảnh chưa được cấu hình cho TôHiệuQuiz.');
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    return new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);
        request.upload.onprogress = (event) => {
            if (event.lengthComputable) progressOptions.onProgress?.(Math.round((event.loaded / event.total) * 100));
        };
        request.onerror = () => reject(new Error('Mạng bị gián đoạn khi tải ảnh.'));
        request.onload = () => {
            let data: CloudinaryResponse | CloudinaryErrorResponse = {};
            try {
                data = JSON.parse(request.responseText || '{}');
            } catch {
                reject(new Error('Phản hồi tải ảnh không hợp lệ.'));
                return;
            }
            if (request.status < 200 || request.status >= 300 || !('secure_url' in data)) {
                const message = 'error' in data && typeof data.error?.message === 'string'
                    ? data.error.message
                    : 'Không thể tải ảnh lên.';
                reject(new Error(message));
                return;
            }
            progressOptions.onProgress?.(100);
            resolve(data.secure_url);
        };
        request.send(formData);
    });
};
