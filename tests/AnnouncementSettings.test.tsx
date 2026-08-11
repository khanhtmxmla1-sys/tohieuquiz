import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  latestDraft: null as any,
}));

vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('../src/utils/toast', () => ({ showSuccess: mocks.success, showError: mocks.error }));
vi.mock('../src/features/feature-rollout/FeatureRolloutPanel', () => ({
  FeatureRolloutPanel: () => React.createElement('div', { 'data-testid': 'feature-rollout-panel' }),
}));
vi.mock('../src/features/notifications/admin/AnnouncementComposer', () => ({
  createEmptyAnnouncementDraft: () => ({
    id: '', content: '', bannerTitle: '', bannerSubtitle: '', bannerLink: '', bannerImage: '',
    ctaLabel: '', status: 'DRAFT', audience: 'ALL', priority: 'INFO', channels: [],
    dismissible: true, startsAt: '', endsAt: '', updatedAt: '', surfaceOverrides: {},
  }),
  AnnouncementComposer: (props: any) => {
    mocks.latestDraft = props.initialDraft;
    return React.createElement(
      'div',
      null,
      React.createElement('span', { 'data-testid': 'composer-status' }, props.initialDraft?.status || 'closed'),
      React.createElement('span', { 'data-testid': 'composer-id' }, props.initialDraft?.id || 'new'),
      React.createElement('span', { 'data-testid': 'composer-content' }, props.initialDraft?.content || ''),
      React.createElement('span', { 'data-testid': 'composer-readonly' }, String(Boolean(props.readOnly))),
      React.createElement('button', {
        type: 'button',
        onClick: () => props.onChange?.({ ...props.initialDraft, content: 'Nội dung đã sửa' }),
      }, 'Sửa nội dung'),
      React.createElement('button', {
        type: 'button',
        onClick: () => props.onSaveDraft?.(props.initialDraft),
      }, 'Lưu từ mock'),
    );
  },
}));

import AnnouncementSettings from '../src/components/TeacherDashboard/AnnouncementSettings';

const item = (
  id: string,
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED',
) => ({
  id,
  content: `Tin ${id}`,
  bannerTitle: `Tiêu đề ${id}`,
  bannerSubtitle: '',
  bannerLink: '',
  bannerImage: '',
  isActive: true,
  isBannerActive: false,
  status,
  effectiveStatus: status,
  audience: 'ALL',
  startsAt: null,
  endsAt: null,
  updatedAt: `2026-08-11T${id === 'first' ? '01' : '02'}:00:00.000Z`,
  priority: 'INFO',
  channels: ['TICKER'],
  dismissible: true,
  ctaLabel: '',
  surfaceOverrides: {},
});

describe('AnnouncementSettings editor safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.latestDraft = null;
  });

  it.each(['ARCHIVED', 'EXPIRED'] as const)(
    'preserves %s status when opening a historical announcement',
    async (status) => {
      mocks.callApi.mockImplementation(async (action: string) => {
        if (action === 'list_announcements') return { data: [item('first', status)] };
        return { data: {} };
      });

      render(<AnnouncementSettings />);

      fireEvent.click(await screen.findByRole('button', { name: 'Mở Tiêu đề first' }));
      await waitFor(() => expect(screen.getByTestId('composer-status')).toHaveTextContent(status));
      expect(mocks.latestDraft?.status).toBe(status);
      expect(screen.getByTestId('composer-readonly')).toHaveTextContent('true');
    },
  );

  it('asks before discarding a dirty draft when returning to the list', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') {
        return { data: [item('first', 'DRAFT'), item('second', 'DRAFT')] };
      }
      return { data: {} };
    });

    render(<AnnouncementSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở Tiêu đề first' }));

    fireEvent.click(screen.getByRole('button', { name: 'Sửa nội dung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' }));

    expect(await screen.findByText('Bỏ thay đổi')).toBeInTheDocument();
    expect(screen.getByText('Tiếp tục chỉnh sửa')).toBeInTheDocument();
  });

  it('guards browser unload while the current draft is dirty', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [item('first', 'DRAFT')] };
      return { data: {} };
    });

    render(<AnnouncementSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở Tiêu đề first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa nội dung' }));

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps a newly created item selected after save and list reload', async () => {
    let listCalls = 0;
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') {
        listCalls += 1;
        return listCalls === 1
          ? { data: [item('first', 'DRAFT')] }
          : { data: [item('first', 'DRAFT'), item('created', 'DRAFT')] };
      }
      if (action === 'create_announcement') {
        return { data: { id: 'created', updatedAt: '2026-08-11T03:00:00.000Z' } };
      }
      return { data: {} };
    });

    render(<AnnouncementSettings />);
    await screen.findByText('Tiêu đề first');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo thông báo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa nội dung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu từ mock' }));

    await waitFor(() => expect(screen.getByTestId('composer-id')).toHaveTextContent('created'));
  });

  it('keeps local edits on 409 and offers loading the latest server version', async () => {
    let serverItem = item('first', 'DRAFT');
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'list_announcements') return { data: [serverItem] };
      if (action === 'update_announcement') {
        throw Object.assign(new Error('Thông báo đã được người khác cập nhật. Vui lòng tải lại.'), { status: 409 });
      }
      return { data: {} };
    });

    render(<AnnouncementSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở Tiêu đề first' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa nội dung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu từ mock' }));

    expect(await screen.findByRole('button', { name: 'Tải bản mới nhất' })).toBeInTheDocument();
    expect(screen.getByTestId('composer-content')).toHaveTextContent('Nội dung đã sửa');

    serverItem = { ...serverItem, content: 'Nội dung từ máy chủ', updatedAt: '2026-08-11T04:00:00.000Z' };
    fireEvent.click(screen.getByRole('button', { name: 'Tải bản mới nhất' }));
    await waitFor(() => expect(screen.getByTestId('composer-content')).toHaveTextContent('Nội dung từ máy chủ'));
  });
});
