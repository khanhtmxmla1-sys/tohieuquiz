import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ showError: vi.fn() }));

vi.mock('../src/utils/toast', () => ({ showError: mocks.showError }));

import { fetchWithJWTInterceptor } from '../src/utils/jwtInterceptor';

describe('fetchWithJWTInterceptor 401 notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
  });

  it('deduplicates a burst of unauthorized responses into one user-facing error', async () => {
    await Promise.all([
      fetchWithJWTInterceptor('/api/one'),
      fetchWithJWTInterceptor('/api/two'),
      fetchWithJWTInterceptor('/api/three'),
    ]);

    expect(mocks.showError).toHaveBeenCalledTimes(1);
    expect(mocks.showError).toHaveBeenCalledWith(
      'Không có quyền truy cập hoặc phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại nếu cần.',
      expect.objectContaining({ id: 'auth-unauthorized' }),
    );
  });
});
