import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createParentAnnouncement: vi.fn(),
  listParentAnnouncements: vi.fn(),
  revokeParentAnnouncement: vi.fn(),
  getParentDelivery: vi.fn(),
}));
vi.mock('../src/features/parent-portal/parentPortalService', () => mocks);

import ParentCommunicationPanel from '../src/features/class-management/components/ParentCommunicationPanel';

const announcements = {
  items: [{
    id: 'a-1', classId: 'class-1', title: 'Họp phụ huynh', body: 'Thứ Sáu', isImportant: true,
    status: 'PUBLISHED', createdBy: 'teacher-a', publishedAt: '2026-07-22T00:00:00.000Z',
    expiresAt: null, revokedAt: null, targetCount: 30, readCount: 12, unreadCount: 18,
  }],
};
const delivery = {
  items: [{
    studentId: 'student-1', studentName: 'Nguyễn Văn An', parentAccessStatus: 'active',
    unreadCount: 2, lastViewedAt: '2026-07-22T00:00:00.000Z',
  }],
};

describe('ParentCommunicationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listParentAnnouncements.mockResolvedValue(announcements);
    mocks.getParentDelivery.mockResolvedValue(delivery);
    mocks.createParentAnnouncement.mockResolvedValue({ announcement: announcements.items[0], delivery: { targetCount: 30, createdCount: 30 } });
    mocks.revokeParentAnnouncement.mockResolvedValue({ id: 'a-1', status: 'REVOKED' });
  });

  it('shows announcement read metrics and parent delivery status', async () => {
    render(<ParentCommunicationPanel classId="class-1" />);
    expect(await screen.findByText('Họp phụ huynh')).toBeInTheDocument();
    expect(screen.getByText('12 đã đọc · 18 chưa đọc')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getAllByText('Đã kích hoạt').length).toBeGreaterThan(0);
    expect(screen.getByText('2 chưa đọc')).toBeInTheDocument();
  });

  it('creates a plain-text class announcement and refreshes data', async () => {
    render(<ParentCommunicationPanel classId="class-1" />);
    await screen.findByText('Họp phụ huynh');
    fireEvent.change(screen.getByLabelText('Tiêu đề thông báo'), { target: { value: '  Nhắc lịch học  ' } });
    fireEvent.change(screen.getByLabelText('Nội dung thông báo'), { target: { value: '  Các em mang sách Toán.  ' } });
    fireEvent.click(screen.getByLabelText('Đánh dấu quan trọng'));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông báo lớp' }));

    await waitFor(() => expect(mocks.createParentAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
      classId: 'class-1', title: 'Nhắc lịch học', body: 'Các em mang sách Toán.', isImportant: true,
    })));
    expect(mocks.listParentAnnouncements).toHaveBeenCalledTimes(2);
    expect(mocks.getParentDelivery).toHaveBeenCalledTimes(2);
  });

  it('revokes an announcement and refreshes the history', async () => {
    render(<ParentCommunicationPanel classId="class-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thu hồi Họp phụ huynh' }));
    await waitFor(() => expect(mocks.revokeParentAnnouncement).toHaveBeenCalledWith('a-1'));
    expect(mocks.listParentAnnouncements).toHaveBeenCalledTimes(2);
  });
});
