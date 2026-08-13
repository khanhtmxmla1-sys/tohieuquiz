import type { Env } from '../types';

const DEFAULT_LOGIN_MEDIA_FOLDER = 'tohieuquiz/login-media';
const DEFAULT_LOGIN_MEDIA_UPLOAD_PRESET = 'tohieuquiz_login_media_signed';
const CLOUDINARY_UPLOAD_HOST = 'api.cloudinary.com';
const CLOUDINARY_DELIVERY_HOST = 'res.cloudinary.com';
export const LOGIN_MEDIA_ALLOWED_FORMATS = 'jpg,jpeg,png,webp';

export interface LoginMediaCloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  uploadPreset: string;
}

export interface LoginMediaUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  assetFolder: string;
  allowedFormats: string;
  uploadPreset: string;
  overwrite: 'false';
  uploadUrl: string;
}

const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const validCloudName = (value: string): boolean => /^[A-Za-z0-9_-]{1,128}$/.test(value);
const validApiKey = (value: string): boolean => /^[A-Za-z0-9_-]{3,128}$/.test(value);

export function normalizeLoginMediaFolder(value: unknown): string | null {
  const folder = clean(value) || DEFAULT_LOGIN_MEDIA_FOLDER;
  if (folder.length > 180 || folder.startsWith('/') || folder.endsWith('/')) return null;
  const segments = folder.split('/');
  if (segments.some((segment) => (
    !segment
    || segment === '.'
    || segment === '..'
    || !/^[A-Za-z0-9._-]+$/.test(segment)
  ))) return null;
  return folder;
}

export function getLoginMediaCloudinaryConfig(env: Env): LoginMediaCloudinaryConfig | null {
  const cloudName = clean(env.CLOUDINARY_CLOUD_NAME);
  const apiKey = clean(env.CLOUDINARY_API_KEY);
  const apiSecret = clean(env.CLOUDINARY_API_SECRET);
  const folder = normalizeLoginMediaFolder(env.CLOUDINARY_LOGIN_MEDIA_FOLDER);
  const uploadPreset = clean(env.CLOUDINARY_LOGIN_MEDIA_UPLOAD_PRESET) || DEFAULT_LOGIN_MEDIA_UPLOAD_PRESET;
  if (!cloudName || !apiKey || !apiSecret || !folder) return null;
  if (!validCloudName(cloudName)
    || !validApiKey(apiKey)
    || apiSecret.length < 3
    || apiSecret.length > 512
    || !/^[A-Za-z0-9_-]{1,128}$/.test(uploadPreset)) {
    return null;
  }
  return { cloudName, apiKey, apiSecret, folder, uploadPreset };
}

export function getLoginMediaPublicIdPrefix(env: Env): string {
  return normalizeLoginMediaFolder(env.CLOUDINARY_LOGIN_MEDIA_FOLDER) || DEFAULT_LOGIN_MEDIA_FOLDER;
}

const toHex = (buffer: ArrayBuffer): string => Array.from(new Uint8Array(buffer))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(digest);
}

export async function createLoginMediaUploadSignature(
  env: Env,
  now = new Date(),
): Promise<LoginMediaUploadSignature | null> {
  const config = getLoginMediaCloudinaryConfig(env);
  if (!config) return null;

  const year = String(now.getUTCFullYear()).padStart(4, '0');
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const assetFolder = `${config.folder}/${year}/${month}`;
  const publicId = `${assetFolder}/${crypto.randomUUID()}`;
  const timestamp = Math.floor(now.getTime() / 1000);
  const params: Record<string, string> = {
    allowed_formats: LOGIN_MEDIA_ALLOWED_FORMATS,
    asset_folder: assetFolder,
    overwrite: 'false',
    public_id: publicId,
    timestamp: String(timestamp),
    upload_preset: config.uploadPreset,
  };
  const serialized = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const signature = await sha256(`${serialized}${config.apiSecret}`);

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    signature,
    publicId,
    assetFolder,
    allowedFormats: LOGIN_MEDIA_ALLOWED_FORMATS,
    uploadPreset: config.uploadPreset,
    overwrite: 'false',
    uploadUrl: `https://${CLOUDINARY_UPLOAD_HOST}/v1_1/${config.cloudName}/image/upload`,
  };
}

export function isLoginMediaPublicIdAllowed(publicId: string, env: Env): boolean {
  const prefix = getLoginMediaPublicIdPrefix(env);
  if (!publicId.startsWith(`${prefix}/`)) return false;
  const rest = publicId.slice(prefix.length + 1);
  const segments = rest.split('/');
  return segments.length >= 3
    && segments.every((segment) => Boolean(segment) && segment !== '.' && segment !== '..');
}

export function isCloudinaryImageUrlAllowed(
  imageUrl: string,
  publicId: string | null,
  env: Env,
): boolean {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname !== CLOUDINARY_DELIVERY_HOST) return false;
  if (url.username || url.password || (url.port && url.port !== '443')) return false;

  const configuredCloudName = clean(env.CLOUDINARY_CLOUD_NAME);
  if (configuredCloudName && validCloudName(configuredCloudName)) {
    if (!url.pathname.startsWith(`/${configuredCloudName}/image/upload/`)) return false;
  } else if (!url.pathname.includes('/image/upload/')) {
    return false;
  }

  if (!publicId) return true;
  if (!isLoginMediaPublicIdAllowed(publicId, env)) return false;
  const marker = '/image/upload/';
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) return false;
  const afterUpload = url.pathname.slice(markerIndex + marker.length);
  const withoutVersion = afterUpload.replace(/^v\d+\//, '');
  const finalSlash = withoutVersion.lastIndexOf('/');
  const leaf = finalSlash >= 0 ? withoutVersion.slice(finalSlash + 1) : withoutVersion;
  const dot = leaf.lastIndexOf('.');
  const withoutExtension = dot > 0
    ? `${withoutVersion.slice(0, finalSlash + 1)}${leaf.slice(0, dot)}`
    : withoutVersion;
  return withoutExtension === publicId;
}
