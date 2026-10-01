import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLoginMedia, parseLoginMediaPublicPayload } from '../src/services/loginMediaService';

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

  it('keeps public crop metadata and defaults old payloads to centered cover', () => {
    const baseSlide = {
      id: 'slide-1',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/slide-1.jpg',
      alt: 'Banner',
      linkUrl: null,
      openNewTab: false,
    };
    const withCrop = parseLoginMediaPublicPayload({
      ...successPayload,
      data: {
        ...successPayload.data,
        mode: 'SLIDER',
        slides: [{ ...baseSlide, cropX: 0.7, cropY: 0.25, cropZoom: 1.4 }],
      },
    });
    const legacy = parseLoginMediaPublicPayload({
      ...successPayload,
      data: { ...successPayload.data, mode: 'SLIDER', slides: [baseSlide] },
    });

    expect(withCrop.slides[0]).toMatchObject({ cropX: 0.7, cropY: 0.25, cropZoom: 1.4 });
    expect(legacy.slides[0]).toMatchObject({ cropX: 0.5, cropY: 0.5, cropZoom: 1 });
  });
});
