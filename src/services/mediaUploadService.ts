import imageCompression from 'browser-image-compression';
import { getWorkersApiBaseUrl } from './api/config';

export type MediaUploadPurpose =
  | 'homework-assignment'
  | 'homework-submission'
  | 'quiz-question';

export interface UploadProgressOptions {
  onProgress?: (value: number) => void;
}

export interface MediaUploadOptions extends UploadProgressOptions {
  purpose: MediaUploadPurpose;
}

interface MediaUploadResponse {
  status?: string;
  data?: { url?: string };
  message?: string;
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

function parseResponse(text: string): MediaUploadResponse {
  try {
    return JSON.parse(text || '{}') as MediaUploadResponse;
  } catch {
    throw new Error('Phản hồi tải tệp không hợp lệ.');
  }
}

export const uploadMedia = async (
  file: File,
  options: MediaUploadOptions,
): Promise<string> => new Promise<string>((resolve, reject) => {
  const request = new XMLHttpRequest();
  request.open('POST', `${getWorkersApiBaseUrl()}/api/media/uploads`);
  request.withCredentials = true;
  request.timeout = 120_000;
  request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
  request.setRequestHeader('X-File-Name', encodeURIComponent(file.name || 'upload'));
  request.setRequestHeader('X-Media-Purpose', options.purpose);

  request.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    }
  };
  request.onerror = () => reject(new Error('Mạng bị gián đoạn khi tải tệp.'));
  request.ontimeout = () => reject(new Error('Tải tệp quá thời gian chờ. Vui lòng thử lại.'));
  request.onload = () => {
    let payload: MediaUploadResponse;
    try {
      payload = parseResponse(request.responseText);
    } catch (error) {
      reject(error);
      return;
    }

    const url = payload.data?.url;
    if (request.status < 200 || request.status >= 300 || typeof url !== 'string' || !url) {
      reject(new Error(payload.message || 'Không thể tải tệp lên.'));
      return;
    }
    options.onProgress?.(100);
    resolve(url);
  };
  request.send(file);
});
