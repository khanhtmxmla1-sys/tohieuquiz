import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('../src/utils/toast', () => ({ showSuccess: mocks.success, showError: mocks.error }));
vi.mock('../src/features/notifications/admin/AnnouncementComposer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/notifications/admin/AnnouncementComposer')>();
  return {
    ...actual,
    AnnouncementComposer: (props: any) => (
      <div data-testid="composer">
        <span data-testid="composer-id">{props.initialDraft?.id || 'new'}</span>
        <span data-testid="composer-status">{props.initialDraft?.status || 'DRAFT'}</span>
        <span data-testid="composer-readonly">{String(Boolean(props.readOnly))}</span>
        <button type="button" onClick={() => props.onChange?.({ ...props.initialDraft, content: 'Đã sửa' })}>Sửa nội dung</button>
        <button type="button" onClick={() => props.onSaveDraft?.(props.initialDraft)}>Lưu nháp mock</button>
        <button type="button" onClick={() => props.onPublish?.(props.initialDraft)}>Công bố mock</button>
      </div>
    ),
  };
});

import AnnouncementManagementPage from '../src/features/notifications/admin/AnnouncementManagementPage';

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  content: `Nội dung ${id}`,
  bannerTitle: `Tiêu đề ${id}`,
  bannerSubtitle: '',
  bannerLink: '',
  bannerImage: '',
  isActive: true,
  isBannerActive: false,
  status: 'DRAFT',
  effectiveStatus: 'DRAFT',
  audience: 'ALL',
  startsAt: null,
  endsAt: null,
  updatedAt: '2026-08-11T01:00:00.000Z',
  priority: 'INFO',
  channels: ['TICKER'],
  dismissible: true,
  ctaLabel: '',
  surfaceOverrides: {},
  ...overrides,
});

describe('AnnouncementManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a list skeleton while loading', () => {
    mocks.callApi.mockReturnValue(new Promise(() => undefined));
    render(<AnnouncementManagementPage />);

    expect(screen.getByRole('status', { name: 'Đang tải danh sách thông báo' })).toBeInTheDocument();
  });

  it('shows an empty state with a create action', async () => {
    mocks.callApi.mockResolvedValue({ data: [] });
    render(<AnnouncementManagementPage />);

    expect(await screen.findByText('Chưa có thông báo nào')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo thông báo đầu tiên' })).toBeInTheDocument();
  });

  it('shows an inline error and retry action', async () => {
    mocks.callApi.mockRejectedValueOnce(new Error('Không tải được dữ liệu'));
    mocks.callApi.mockResolvedValueOnce({ data: [] });
    render(<AnnouncementManagementPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được dữ liệu');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có thông báo nào')).toBeInTheDocument();
    expect(mocks.callApi).toHaveBeenCalledTimes(2);
  });

  it('shows Vietnamese status counts and filters by status, audience, preset and search', async () => {
    mocks.callApi.mockResolvedValue({ data: [
      row('draft'),
      row('scheduled', { effectiveStatus: 'SCHEDULED', audience: 'TEACHERS', startsAt: '2026-08-11T03:00:00.000Z' }),
      row('banner', { effectiveStatus: 'PUBLISHED', audience: 'STUDENTS', channels: ['BANNER'], bannerTitle: 'Khai giảng' }),
    ] });
    render(<AnnouncementManagementPage />);

    const allTab = await screen.findByRole('button', { name: /Tất cả 3/ });
    expect(allTab).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bản nháp 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đã lên lịch 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đang hiển thị 1/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Đang hiển thị 1/ }));
    expect(screen.getByText('Khai giảng')).toBeInTheDocument();
    expect(screen.queryByText('Tiêu đề draft')).not.toBeInTheDocument();

    fireEvent.click(allTab);
    fireEvent.change(screen.getByLabelText('Đối tượng lọc'), { target: { value: 'STUDENTS' } });
    fireEvent.change(screen.getByLabelText('Loại thông báo lọc'), { target: { value: 'BANNER' } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm thông báo' }), { target: { value: 'KHAI GIẢNG' } });
    const list = screen.getByRole('list', { name: 'Danh sách thông báo' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('saves a draft without invoking publish', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [row('draft')] };
      if (action === 'update_announcement') return { data: { id: 'draft', updatedAt: '2026-08-11T02:00:00.000Z' } };
      return { data: {} };
    });
    render(<AnnouncementManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Mở Tiêu đề draft/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp mock' }));

    await waitFor(() => expect(mocks.callApi).toHaveBeenCalledWith(
      'update_announcement',
      expect.objectContaining({ id: 'draft', status: 'DRAFT' }),
    ));
    expect(mocks.callApi.mock.calls.some(([action]) => action === 'publish_announcement')).toBe(false);
  });

  it('publishes immediately exactly once after persisting the normalized draft', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [row('draft', { audience: 'TEACHERS' })] };
      if (action === 'update_announcement') return { data: { id: 'draft', updatedAt: '2026-08-11T02:00:00.000Z' } };
      if (action === 'publish_announcement') return { data: { id: 'draft', status: 'PUBLISHED', updatedAt: '2026-08-11T03:00:00.000Z' } };
      return { data: {} };
    });
    render(<AnnouncementManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Mở Tiêu đề draft/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Công bố mock' }));

    await waitFor(() => expect(mocks.callApi.mock.calls.filter(([action]) => action === 'publish_announcement')).toHaveLength(1));
    expect(mocks.callApi.mock.calls.filter(([action]) => action === 'update_announcement')).toHaveLength(1);
  });

  it('schedules exactly once after saving the SCHEDULED draft', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [row('scheduled', {
        status: 'SCHEDULED', effectiveStatus: 'SCHEDULED', audience: 'TEACHERS', startsAt: '2026-08-12T01:30:00.000Z',
      })] };
      if (action === 'update_announcement') return { data: { id: 'scheduled', updatedAt: '2026-08-11T02:00:00.000Z' } };
      if (action === 'publish_announcement') return { data: { id: 'scheduled', status: 'SCHEDULED', updatedAt: '2026-08-11T03:00:00.000Z' } };
      return { data: {} };
    });
    render(<AnnouncementManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Mở Tiêu đề scheduled/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Công bố mock' }));

    await waitFor(() => expect(mocks.callApi).toHaveBeenCalledWith(
      'update_announcement',
      expect.objectContaining({ status: 'SCHEDULED' }),
    ));
    expect(mocks.callApi.mock.calls.filter(([action]) => action === 'publish_announcement')).toHaveLength(1);
  });

  it('shows only valid scheduled lifecycle actions and confirms cancellation', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [row('scheduled', { status: 'SCHEDULED', effectiveStatus: 'SCHEDULED' })] };
      if (action === 'cancel_announcement') return { data: { id: 'scheduled', status: 'DRAFT', updatedAt: '2026-08-11T03:00:00.000Z' } };
      return { data: {} };
    });
    render(<AnnouncementManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Mở Tiêu đề scheduled/ }));
    expect(screen.getByRole('button', { name: 'Hủy lịch' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kết thúc thông báo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhân bản' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hủy lịch' }));
    expect(await screen.findByRole('dialog', { name: 'Hủy lịch thông báo?' })).toBeInTheDocument();
    expect(mocks.callApi.mock.calls.some(([action]) => action === 'cancel_announcement')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy lịch' }));
    await waitFor(() => expect(mocks.callApi.mock.calls.some(([action]) => action === 'cancel_announcement')).toBe(true));
  });

  it('ends a published announcement with confirmation and switches the editor to readonly', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [row('live', { status: 'PUBLISHED', effectiveStatus: 'PUBLISHED' })] };
      if (action === 'end_announcement') return { data: { id: 'live', status: 'EXPIRED', updatedAt: '2026-08-11T03:00:00.000Z' } };
      return { data: {} };
    });
    render(<AnnouncementManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Mở Tiêu đề live/ }));
    expect(screen.getByRole('button', { name: 'Kết thúc thông báo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy lịch' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc thông báo' }));
    expect(await screen.findByRole('dialog', { name: 'Kết thúc thông báo?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận kết thúc' }));

    await waitFor(() => expect(screen.getByTestId('composer-status')).toHaveTextContent('EXPIRED'));
    expect(screen.getByTestId('composer-readonly')).toHaveTextContent('true');
  });

  it('duplicates locally without a mutation and resets identity, status and schedule', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [row('live', {
        status: 'PUBLISHED', effectiveStatus: 'PUBLISHED', startsAt: '2026-08-11T01:00:00.000Z', endsAt: '2026-08-12T01:00:00.000Z',
      })] };
      return { data: {} };
    });
    render(<AnnouncementManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Mở Tiêu đề live/ }));
    const callsBeforeDuplicate = mocks.callApi.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Nhân bản' }));

    expect(screen.getByTestId('composer-id')).toHaveTextContent('new');
    expect(screen.getByTestId('composer-status')).toHaveTextContent('DRAFT');
    expect(mocks.callApi.mock.calls).toHaveLength(callsBeforeDuplicate);
  });

  it('keeps the editor open when a confirmed lifecycle mutation fails', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [row('draft')] };
      if (action === 'archive_announcement') throw new Error('Không thể lưu trữ');
      return { data: {} };
    });
    render(<AnnouncementManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Mở Tiêu đề draft/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ' }));
    expect(await screen.findByRole('dialog', { name: 'Lưu trữ thông báo?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu trữ' }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Không thể lưu trữ'));
    expect(screen.getByTestId('composer-id')).toHaveTextContent('draft');
  });

  it('opens the editor as a separate full-width view instead of a narrow list column', async () => {
    mocks.callApi.mockResolvedValue({ data: [row('first')] });
    render(<AnnouncementManagementPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Mở Tiêu đề first/ }));

    expect(screen.getByTestId('composer-id')).toHaveTextContent('first');
    expect(screen.queryByRole('list', { name: 'Danh sách thông báo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại danh sách' })).toBeInTheDocument();
  });
});
