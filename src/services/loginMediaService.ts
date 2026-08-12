import type {
  LoginMediaDisplayMode,
  LoginMediaPublicData,
  LoginMediaPublicSettings,
  LoginMediaPublicSlide,
  LoginMediaTransition,
} from '../components/HomePage/components/login-media/loginMedia.types';
import { getWorkersApiBaseUrl } from './api/config';

const INVALID_PAYLOAD_MESSAGE = 'Dữ liệu nội dung trang đăng nhập không hợp lệ.';
const REQUEST_FAILED_MESSAGE = 'Không thể tải nội dung trang đăng nhập.';

const isObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isDisplayMode = (value: unknown): value is LoginMediaDisplayMode => (
  value === 'CONTENT' || value === 'SLIDER'
);

const isTransition = (value: unknown): value is LoginMediaTransition => (
  value === 'FADE' || value === 'SLIDE'
);

const isNullableString = (value: unknown): value is string | null => (
  value === null || typeof value === 'string'
);

function parseSettings(value: unknown): LoginMediaPublicSettings {
  if (!isObject(value)
    || typeof value.autoplay !== 'boolean'
    || typeof value.intervalMs !== 'number'
    || !Number.isFinite(value.intervalMs)
    || value.intervalMs < 2000
    || value.intervalMs > 30000
    || !isTransition(value.transition)
    || typeof value.showDots !== 'boolean'
    || typeof value.showArrows !== 'boolean'
    || typeof value.pauseOnHover !== 'boolean') {
    throw new Error(INVALID_PAYLOAD_MESSAGE);
  }

  return {
    autoplay: value.autoplay,
    intervalMs: value.intervalMs,
    transition: value.transition,
    showDots: value.showDots,
    showArrows: value.showArrows,
    pauseOnHover: value.pauseOnHover,
  };
}

function parseSlide(value: unknown): LoginMediaPublicSlide {
  if (!isObject(value)) throw new Error(INVALID_PAYLOAD_MESSAGE);
  const id = value.id;
  const imageUrl = value.imageUrl;
  const alt = value.alt;
  const linkUrl = value.linkUrl;
  const openNewTab = value.openNewTab;

  if (!isNullableString(linkUrl)) throw new Error(INVALID_PAYLOAD_MESSAGE);
  if (typeof id !== 'string'
    || !id
    || typeof imageUrl !== 'string'
    || !imageUrl
    || typeof alt !== 'string'
    || typeof openNewTab !== 'boolean') {
    throw new Error(INVALID_PAYLOAD_MESSAGE);
  }

  return { id, imageUrl, alt, linkUrl, openNewTab };
}

export function parseLoginMediaPublicPayload(payload: unknown): LoginMediaPublicData {
  if (!isObject(payload) || payload.status !== 'success' || !isObject(payload.data)) {
    throw new Error(INVALID_PAYLOAD_MESSAGE);
  }

  const data = payload.data;
  if (!isDisplayMode(data.mode) || !Array.isArray(data.slides)) {
    throw new Error(INVALID_PAYLOAD_MESSAGE);
  }

  return {
    mode: data.mode,
    settings: parseSettings(data.settings),
    slides: data.slides.map(parseSlide),
    ...(typeof data.degraded === 'boolean' ? { degraded: data.degraded } : {}),
  };
}

export async function getLoginMedia(): Promise<LoginMediaPublicData> {
  const response = await fetch(`${getWorkersApiBaseUrl()}/api/login-media`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new Error(REQUEST_FAILED_MESSAGE);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(INVALID_PAYLOAD_MESSAGE);
  }
  return parseLoginMediaPublicPayload(payload);
}
