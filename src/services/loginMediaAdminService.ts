import type {
  LoginMediaAdminSettings,
  LoginMediaAdminSlide,
  LoginMediaAdminState,
  LoginMediaSettingsUpdate,
  LoginMediaSlideInput,
  LoginMediaSlideUpdate,
  LoginMediaUploadSignatureData,
  LoginMediaUploadedImage,
} from '../features/login-media/loginMediaAdmin.types';
import { getWorkersApiBaseUrl } from './api/config';
import { normalizeNetworkError, toApiError } from './api/errors';

const baseUrl = () => getWorkersApiBaseUrl();

type SuccessEnvelope<T> = { status: 'success'; data: T };

const requestJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    if (!response.ok) throw await toApiError(response);
    const payload = await response.json() as SuccessEnvelope<T>;
    if (!payload || payload.status !== 'success' || !('data' in payload)) {
      throw new Error('Dữ liệu banner đăng nhập không hợp lệ.');
    }
    return payload.data;
  } catch (error) {
    throw normalizeNetworkError(error);
  }
};

export const getLoginMediaAdminState = (): Promise<LoginMediaAdminState> => (
  requestJson<LoginMediaAdminState>('/api/admin/login-media', { method: 'GET' })
);

export const updateLoginMediaSettings = (input: LoginMediaSettingsUpdate): Promise<LoginMediaAdminSettings> => (
  requestJson<LoginMediaAdminSettings>('/api/admin/login-media/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
);

export const requestLoginMediaUploadSignature = (): Promise<LoginMediaUploadSignatureData> => (
  requestJson<LoginMediaUploadSignatureData>('/api/admin/login-media/upload-signature', { method: 'POST' })
);

export function buildCloudinaryUploadFormData(
  file: File,
  signature: LoginMediaUploadSignatureData,
): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('public_id', signature.publicId);
  form.append('asset_folder', signature.assetFolder);
  form.append('allowed_formats', signature.allowedFormats);
  form.append('upload_preset', signature.uploadPreset);
  form.append('overwrite', signature.overwrite);
  return form;
}

const parseCloudinaryUpload = (value: unknown): LoginMediaUploadedImage => {
  if (!value || typeof value !== 'object') throw new Error('Cloudinary trả về dữ liệu ảnh không hợp lệ.');
  const row = value as Record<string, unknown>;
  if (typeof row.secure_url !== 'string'
    || typeof row.public_id !== 'string'
    || !Number.isInteger(row.width)
    || !Number.isInteger(row.height)
    || Number(row.width) <= 0
    || Number(row.height) <= 0) {
    throw new Error('Cloudinary trả về dữ liệu ảnh không hợp lệ.');
  }
  return {
    secureUrl: row.secure_url,
    publicId: row.public_id,
    width: Number(row.width),
    height: Number(row.height),
  };
};

export const uploadLoginMediaImage = (
  file: File,
  signature: LoginMediaUploadSignatureData,
  onProgress: (percent: number) => void = () => undefined,
): Promise<LoginMediaUploadedImage> => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', signature.uploadUrl);
  xhr.responseType = 'json';
  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable || event.total <= 0) return;
    onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
  };
  xhr.onerror = () => reject(new Error('Không thể tải ảnh lên Cloudinary. Vui lòng thử lại.'));
  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      reject(new Error('Cloudinary từ chối ảnh tải lên. Vui lòng kiểm tra định dạng và thử lại.'));
      return;
    }
    try {
      resolve(parseCloudinaryUpload(xhr.response));
    } catch (error) {
      reject(error);
    }
  };
  xhr.send(buildCloudinaryUploadFormData(file, signature));
});

export const createLoginMediaSlide = (input: LoginMediaSlideInput): Promise<LoginMediaAdminSlide> => (
  requestJson<LoginMediaAdminSlide>('/api/admin/login-media/slides', {
    method: 'POST',
    body: JSON.stringify(input),
  })
);

export const updateLoginMediaSlide = (
  id: string,
  input: LoginMediaSlideUpdate,
): Promise<LoginMediaAdminSlide> => (
  requestJson<LoginMediaAdminSlide>(`/api/admin/login-media/slides/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
);

export const reorderLoginMediaSlides = (
  slideIds: string[],
  reason: string,
): Promise<{ slideIds: string[] }> => (
  requestJson<{ slideIds: string[] }>('/api/admin/login-media/slides/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ slideIds, reason }),
  })
);

export const deleteLoginMediaSlide = (
  id: string,
  expectedUpdatedAt: string,
): Promise<{ id: string }> => (
  requestJson<{ id: string }>(`/api/admin/login-media/slides/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedUpdatedAt }),
  })
);
