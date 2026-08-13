import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCloudinaryUploadFormData,
  getLoginMediaAdminState,
  requestLoginMediaUploadSignature,
} from '../src/services/loginMediaAdminService';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const signature = {
  cloudName: 'demo',
  apiKey: '12345',
  timestamp: 1786581750,
  signature: 'abc123',
  publicId: 'tohieuquiz/login-media/2026/08/uuid',
  assetFolder: 'tohieuquiz/login-media/2026/08',
  allowedFormats: 'jpg,jpeg,png,webp',
  uploadPreset: 'tohieuquiz_login_media_signed',
  overwrite: 'false' as const,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};

beforeEach(() => fetchMock.mockReset());

describe('loginMediaAdminService', () => {
  it('loads admin state with cookie credentials and no public endpoint confusion', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'success',
      data: { settings: { version: 1 }, slides: [] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await getLoginMediaAdminState();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/admin\/login-media$/), expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }));
  });

  it('requests a server-controlled upload signature without accepting folder or public-id input', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', data: signature }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const result = await requestLoginMediaUploadSignature();
    const [, init] = fetchMock.mock.calls[0];

    expect(result).toEqual(signature);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBeUndefined();
  });

  it('builds the Cloudinary multipart body with exactly the signed upload parameters', () => {
    const file = new File(['image'], 'banner.webp', { type: 'image/webp' });
    const form = buildCloudinaryUploadFormData(file, signature);

    expect(form.get('file')).toBe(file);
    expect(form.get('api_key')).toBe(signature.apiKey);
    expect(form.get('timestamp')).toBe(String(signature.timestamp));
    expect(form.get('signature')).toBe(signature.signature);
    expect(form.get('public_id')).toBe(signature.publicId);
    expect(form.get('asset_folder')).toBe(signature.assetFolder);
    expect(form.get('allowed_formats')).toBe(signature.allowedFormats);
    expect(form.get('upload_preset')).toBe(signature.uploadPreset);
    expect(form.get('overwrite')).toBe('false');
    expect([...form.keys()].sort()).toEqual([
      'allowed_formats', 'api_key', 'asset_folder', 'file', 'overwrite', 'public_id', 'signature', 'timestamp', 'upload_preset',
    ].sort());
  });
});
