import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/services/api/errors';

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  updateSettings: vi.fn(),
  requestSignature: vi.fn(),
  uploadImage: vi.fn(),
  createSlide: vi.fn(),
  updateSlide: vi.fn(),
  reorderSlides: vi.fn(),
  deleteSlide: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../src/services/loginMediaAdminService', () => ({
  getLoginMediaAdminState: mocks.getState,
  updateLoginMediaSettings: mocks.updateSettings,
  requestLoginMediaUploadSignature: mocks.requestSignature,
  uploadLoginMediaImage: mocks.uploadImage,
  createLoginMediaSlide: mocks.createSlide,
  updateLoginMediaSlide: mocks.updateSlide,
  reorderLoginMediaSlides: mocks.reorderSlides,
  deleteLoginMediaSlide: mocks.deleteSlide,
}));

vi.mock('../src/utils/toast', () => ({
  showSuccess: mocks.success,
  showError: mocks.error,
}));

import LoginMediaAdminPage from '../src/features/login-media/admin/LoginMediaAdminPage';

const settings = {
  id: 'default',
  displayMode: 'CONTENT' as const,
  autoplay: true,
  intervalMs: 5000,
  transition: 'FADE' as const,
  showDots: true,
  showArrows: true,
  pauseOnHover: true,
  version: 3,
  updatedAt: '2026-08-12T16:00:00.000Z',
  updatedBy: 'admin-1',
};

const slide = (id: string, title: string, sortOrder: number) => ({
  id,
  cloudinaryPublicId: `tohieuquiz/login-media/2026/08/${id}`,
  imageUrl: `https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/${id}.webp`,
  imageWidth: 1200,
  imageHeight: 520,
  altText: title,
  internalTitle: title,
  linkUrl: null,
  openNewTab: false,
  sortOrder,
  enabled: true,
  startsAt: null,
  endsAt: null,
  createdAt: '2026-08-12T15:00:00.000Z',
  createdBy: 'admin-1',
  updatedAt: '2026-08-12T15:00:00.000Z',
  updatedBy: 'admin-1',
});

const state = () => ({
  settings: { ...settings },
  slides: [slide('slide-1', 'Banner tháng 8', 10), slide('slide-2', 'Banner luyện tập', 20)],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getState.mockResolvedValue(state());
  mocks.updateSettings.mockResolvedValue({ ...settings, displayMode: 'SLIDER', intervalMs: 7000, version: 4 });
  mocks.requestSignature.mockResolvedValue({
    cloudName: 'demo', apiKey: '123', timestamp: 1, signature: 'signature',
    publicId: 'tohieuquiz/login-media/2026/08/uploaded',
    assetFolder: 'tohieuquiz/login-media/2026/08',
    allowedFormats: 'jpg,jpeg,png,webp', uploadPreset: 'tohieuquiz_login_media_signed', overwrite: 'false',
    uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
  });
  mocks.uploadImage.mockResolvedValue({
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/uploaded.webp',
    publicId: 'tohieuquiz/login-media/2026/08/uploaded', width: 1200, height: 520,
  });
  mocks.createSlide.mockResolvedValue(slide('created', 'Banner mới', 30));
  mocks.reorderSlides.mockResolvedValue({ slideIds: ['slide-2', 'slide-1'] });
});

describe('LoginMediaAdminPage', () => {
  it('loads settings and the banner list', async () => {
    render(<LoginMediaAdminPage />);

    expect(await screen.findByRole('heading', { name: 'Banner đăng nhập' })).toBeInTheDocument();
    expect(screen.getByText('Banner tháng 8')).toBeInTheDocument();
    expect(screen.getByText('Banner luyện tập')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tổng quan học tập' })).toBeChecked();
  });

  it('saves slider settings with version, interval and an audit reason', async () => {
    render(<LoginMediaAdminPage />);
    await screen.findByText('Banner tháng 8');

    fireEvent.click(screen.getByRole('radio', { name: 'Trình chiếu ảnh' }));
    fireEvent.change(screen.getByLabelText('Thời gian mỗi ảnh (giây)'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Bật banner tuyển sinh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));

    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion: 3,
      displayMode: 'SLIDER',
      intervalMs: 7000,
      reason: 'Bật banner tuyển sinh',
    })));
  });

  it('uploads directly through the signed Cloudinary flow and creates a disabled banner', async () => {
    render(<LoginMediaAdminPage />);
    await screen.findByText('Banner tháng 8');

    fireEvent.click(screen.getByRole('button', { name: 'Thêm banner' }));
    const file = new File([new Uint8Array(1024)], 'banner.webp', { type: 'image/webp' });
    fireEvent.change(screen.getByLabelText('Chọn ảnh banner'), { target: { files: [file] } });

    await waitFor(() => expect(mocks.requestSignature).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.uploadImage).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ publicId: 'tohieuquiz/login-media/2026/08/uploaded' }),
      expect.any(Function),
    ));

    fireEvent.change(screen.getByLabelText('Tên nội bộ'), { target: { value: 'Banner mới' } });
    fireEvent.change(screen.getByLabelText('Mô tả ảnh'), { target: { value: 'Thông báo ôn tập tháng 8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu banner' }));

    await waitFor(() => expect(mocks.createSlide).toHaveBeenCalledWith(expect.objectContaining({
      cloudinaryPublicId: 'tohieuquiz/login-media/2026/08/uploaded',
      imageWidth: 1200,
      imageHeight: 520,
      internalTitle: 'Banner mới',
      altText: 'Thông báo ôn tập tháng 8',
      enabled: false,
    })));
  });

  it('reorders banners with accessible move controls', async () => {
    render(<LoginMediaAdminPage />);
    await screen.findByText('Banner tháng 8');

    const first = screen.getByTestId('login-media-slide-slide-1');
    fireEvent.click(within(first).getByRole('button', { name: 'Chuyển Banner tháng 8 xuống' }));

    await waitFor(() => expect(mocks.reorderSlides).toHaveBeenCalledWith(
      ['slide-2', 'slide-1'],
      'Sắp xếp banner từ giao diện quản trị',
    ));
  });

  it('reloads the latest settings when an optimistic update conflicts', async () => {
    mocks.updateSettings.mockRejectedValueOnce(new ApiError('Dữ liệu đã thay đổi', 409));
    render(<LoginMediaAdminPage />);
    await screen.findByText('Banner tháng 8');

    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Đổi cấu hình' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));

    await waitFor(() => expect(mocks.getState).toHaveBeenCalledTimes(2));
    expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/được cập nhật ở nơi khác/i));
  });

  it('rejects unsupported or oversized files before asking for a signature', async () => {
    render(<LoginMediaAdminPage />);
    await screen.findByText('Banner tháng 8');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm banner' }));

    const invalid = new File([new Uint8Array(1024)], 'banner.gif', { type: 'image/gif' });
    fireEvent.change(screen.getByLabelText('Chọn ảnh banner'), { target: { files: [invalid] } });

    expect(mocks.requestSignature).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/JPEG, PNG hoặc WebP/i));
  });
});
