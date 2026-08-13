import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLoginMedia } from '../src/services/loginMediaService';

const successPayload = {
  status: 'success',
  data: {
    mode: 'CONTENT',
    settings: {
      autoplay: true,
      intervalMs: 5000,
      transition: 'FADE',
      showDots: true,
      showArrows: true,
      pauseOnHover: true,
    },
    slides: [],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loginMediaService', () => {
  it('loads the public login-media contract without credentials or admin data', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(successPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getLoginMedia()).resolves.toEqual(successPayload.data);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/login-media$/);
    expect(init).toMatchObject({ method: 'GET' });
  });

  it('rejects a failed response so the login boundary can fall back safely', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));

    await expect(getLoginMedia()).rejects.toThrow('Không thể tải nội dung trang đăng nhập.');
  });

  it('rejects malformed public payloads instead of trusting unexpected data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'success', data: { mode: 'SLIDER' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(getLoginMedia()).rejects.toThrow('Dữ liệu nội dung trang đăng nhập không hợp lệ.');
  });
});
