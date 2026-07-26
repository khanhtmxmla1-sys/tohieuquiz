import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchImageMock = vi.hoisted(() => vi.fn());
const markAsReadMock = vi.hoisted(() => vi.fn());
const notificationItems = vi.hoisted(() => ({ value: [] as any[] }));

vi.mock('../src/features/certificates/useCertificates', () => ({
  fetchCertificateImageBlob: fetchImageMock,
}));

vi.mock('../src/hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({
    isLoading: false,
    markAsRead: markAsReadMock,
    notifications: notificationItems.value,
  }),
}));

import CertificateCard from '../src/features/certificates/CertificateCard';
import NotificationBell from '../src/components/common/NotificationBell';

describe('certificate frontend', () => {
  beforeEach(() => {
    fetchImageMock.mockReset();
    fetchImageMock.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    markAsReadMock.mockReset();
    markAsReadMock.mockResolvedValue(undefined);
    notificationItems.value = [{
      id: 'notification-1', type: 'certificate_issued', title: 'Bạn có chứng nhận mới',
      body: 'Hoàn thành tốt', data: { certificate_id: 'cert-1' }, is_read: false,
      created_at: '2026-07-14T00:00:00.000Z',
    }];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:certificate-1'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('loads the protected image as a blob and enables download', async () => {
    render(<CertificateCard cert={{
      id: 'cert-1', batchId: 'batch-1', title: 'Hoàn thành tốt', teacherName: 'Cô Nguyễn',
      studentScore: 0, quizTitle: 'Tiếng Việt', pngUrl: '/api/certificates/cert-1/image',
      issuedAt: '2026-07-14T00:00:00.000Z', renderStatus: 'sent',
    }} />);

    await waitFor(() => expect(fetchImageMock).toHaveBeenCalledWith('/api/certificates/cert-1/image'));
    expect(await screen.findByAltText('Hoàn thành tốt')).toHaveAttribute('src', 'blob:certificate-1');
    expect(screen.getByRole('button', { name: /Tải về/i })).toBeEnabled();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('marks a notification read and deep-links to achievements', async () => {
    const openCertificate = vi.fn();
    render(<NotificationBell userId="student-1" onOpenCertificate={openCertificate} />);

    const notificationButton = screen.getByRole('button', { name: /Thông báo, 1 chưa đọc/i });
    expect(notificationButton).toHaveClass('inline-flex', 'min-h-11', 'min-w-11');
    fireEvent.click(notificationButton);
    fireEvent.click(screen.getByRole('button', { name: /Bạn có chứng nhận mới/i }));

    await waitFor(() => expect(markAsReadMock).toHaveBeenCalledWith('notification-1'));
    expect(openCertificate).toHaveBeenCalledWith('cert-1');
  });

  it('marks a result-report notification read and opens the exact private report', async () => {
    notificationItems.value = [{
      id: 'notification-report-1', type: 'result_report_published',
      title: 'Bạn có phiếu kết quả mới', body: 'Bài 1 – Ôn tập phép nhân',
      data: { phieu_id: 'phieu-an', result_id: 'result-an' }, is_read: false,
      created_at: '2026-07-21T00:00:00.000Z',
    }];
    const openCertificate = vi.fn();
    const openResultReport = vi.fn();
    render(
      <NotificationBell
        userId="student-1"
        onOpenCertificate={openCertificate}
        onOpenResultReport={openResultReport}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Thông báo, 1 chưa đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /Bạn có phiếu kết quả mới/i }));

    await waitFor(() => expect(markAsReadMock).toHaveBeenCalledWith('notification-report-1'));
    expect(openResultReport).toHaveBeenCalledWith('phieu-an');
    expect(openCertificate).not.toHaveBeenCalled();
  });
});
