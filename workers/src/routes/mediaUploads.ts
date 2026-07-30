import type { Env } from '../types';
import { verifyJWTMiddleware } from '../middleware/jwtAuth';
import type { JWTPayload } from '../utils/jwt';
import { errorResponse, jsonResponse } from '../utils/response';

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;

export type MediaUploadPurpose =
  | 'homework-assignment'
  | 'homework-submission'
  | 'quiz-question';

const PURPOSES = new Set<MediaUploadPurpose>([
  'homework-assignment',
  'homework-submission',
  'quiz-question',
]);

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function allowedTypes(purpose: MediaUploadPurpose): Set<string> {
  return purpose === 'homework-assignment'
    ? new Set([...IMAGE_TYPES, 'application/pdf'])
    : IMAGE_TYPES;
}

function roleCanUpload(user: JWTPayload, purpose: MediaUploadPurpose): boolean {
  if (user.role === 'admin' || user.role === 'teacher') return true;
  return user.role === 'student' && purpose === 'homework-submission';
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function detectContentType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytes.length >= 12
    && startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50) return 'image/webp';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

function sanitizeOriginalName(rawValue: string | null): string {
  let decoded = rawValue || 'upload';
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the original bounded value when a client sends malformed percent encoding.
  }
  return decoded
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 128) || 'upload';
}

function publicBaseUrl(env: Env): string | null {
  try {
    const value = String(env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString().replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

function noStoreJson(data: unknown, status: number): Response {
  const response = jsonResponse(data, status);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

export async function handleMediaUploadRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  if (path !== '/api/media/uploads') return errorResponse('Not found', 404);
  if (method !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const bucket = env.OG_IMAGES;
  const baseUrl = publicBaseUrl(env);
  if (!bucket || typeof bucket.put !== 'function' || !baseUrl) {
    return errorResponse('Dịch vụ lưu trữ tệp đang tạm thời không khả dụng.', 503);
  }

  const rawPurpose = String(request.headers.get('X-Media-Purpose') || '').trim();
  if (!PURPOSES.has(rawPurpose as MediaUploadPurpose)) {
    return errorResponse('Mục đích tải tệp không hợp lệ.', 400);
  }
  const purpose = rawPurpose as MediaUploadPurpose;
  if (!roleCanUpload(user, purpose)) return errorResponse('Forbidden', 403);

  const declaredType = String(request.headers.get('Content-Type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!allowedTypes(purpose).has(declaredType)) {
    return errorResponse('Định dạng tệp không được hỗ trợ.', 415);
  }

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MEDIA_UPLOAD_BYTES) {
    return errorResponse('Tệp vượt quá giới hạn 10 MB.', 413);
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return errorResponse('Tệp tải lên đang trống.', 400);
  if (bytes.byteLength > MAX_MEDIA_UPLOAD_BYTES) return errorResponse('Tệp vượt quá giới hạn 10 MB.', 413);

  const detectedType = detectContentType(bytes);
  if (!detectedType || detectedType !== declaredType || !allowedTypes(purpose).has(detectedType)) {
    return errorResponse('Nội dung tệp không khớp với định dạng đã khai báo.', 415);
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const extension = EXTENSIONS[detectedType];
  const key = `media/${purpose}/${user.role}/${year}/${month}/${crypto.randomUUID()}.${extension}`;
  const uploadedBy = String(user.id || user.username).slice(0, 128);
  const originalName = sanitizeOriginalName(request.headers.get('X-File-Name'));
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  await bucket.put(key, body, {
    httpMetadata: {
      contentType: detectedType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      uploadedBy,
      role: user.role,
      purpose,
      originalName,
    },
  });

  return noStoreJson({
    status: 'success',
    data: {
      url: `${baseUrl}/${key}`,
      key,
      contentType: detectedType,
      size: bytes.byteLength,
    },
  }, 201);
}
