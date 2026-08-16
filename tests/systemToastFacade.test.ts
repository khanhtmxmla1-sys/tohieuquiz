import { beforeEach, describe, expect, it, vi } from 'vitest';

const hotToast = vi.hoisted(() => ({
  success: vi.fn(() => 'success-id'),
  error: vi.fn(() => 'error-id'),
  loading: vi.fn(() => 'loading-id'),
  base: vi.fn(() => 'base-id'),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(hotToast.base, {
    success: hotToast.success,
    error: hotToast.error,
    loading: hotToast.loading,
    dismiss: vi.fn(),
  }),
}));

import { showError, showInfo, showSuccess } from '../src/utils/toast';

describe('system toast facade contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards a stable toast id and duration through the centralized success facade', () => {
    expect(showSuccess('Đã lưu', { id: 'save-result', duration: 1200 })).toBe('success-id');

    expect(hotToast.success).toHaveBeenCalledWith(
      'Đã lưu',
      expect.objectContaining({ id: 'save-result', duration: 1200 }),
    );
  });

  it('forwards a stable toast id and duration through the centralized error facade', () => {
    expect(showError('Phiên đã hết hạn', { id: 'auth-401', duration: 1800 })).toBe('error-id');

    expect(hotToast.error).toHaveBeenCalledWith(
      'Phiên đã hết hạn',
      expect.objectContaining({ id: 'auth-401', duration: 1800 }),
    );
  });

  it('preserves custom neutral-toast options through the centralized info facade', () => {
    expect(showInfo('Đã điểm danh', { id: 'attendance', icon: '📅', duration: 900 })).toBe('base-id');

    expect(hotToast.base).toHaveBeenCalledWith(
      'Đã điểm danh',
      expect.objectContaining({ id: 'attendance', icon: '📅', duration: 900 }),
    );
  });
});
