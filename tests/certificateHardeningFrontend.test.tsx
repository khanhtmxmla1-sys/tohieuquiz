import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const studentHook = vi.hoisted(() => ({
  value: {} as any,
}));
const teacherHook = vi.hoisted(() => ({
  value: {} as any,
}));
const fetchImageMock = vi.hoisted(() => vi.fn());

vi.mock('../src/components/common', () => ({
  ModuleIcon: () => <span data-testid="module-icon" />,
}));

vi.mock('../src/features/certificates/useCertificates', () => ({
  useCertificates: () => studentHook.value,
  fetchCertificateImageBlob: fetchImageMock,
}));

vi.mock('../src/features/certificates/useBatches', () => ({
  useBatches: () => teacherHook.value,
}));

vi.mock('../src/features/certificates/CertificateCard', () => ({
  default: ({ cert }: { cert: { title: string } }) => <article>{cert.title}</article>,
}));

import StudentAchievementsPage from '../src/features/certificates/StudentAchievementsPage';
import TeacherCertificatesPage from '../src/features/certificates/TeacherCertificatesPage';

const certificate = {
  id: 'cert-1', batchId: 'batch-1', title: 'Hoàn thành tốt', teacherName: 'Cô A',
  studentScore: 10, quizTitle: 'Toán', pngUrl: '/api/certificates/cert-1/image',
  issuedAt: '2026-08-15T00:00:00.000Z', renderStatus: 'sent' as const,
};

describe('certificate hardening frontend', () => {
  beforeEach(() => {
    fetchImageMock.mockReset();
    fetchImageMock.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    studentHook.value = {
      certificates: [certificate],
      isLoading: false,
      isLoadingMore: false,
      error: null,
      refetch: vi.fn(),
      loadMore: vi.fn(),
      hasMore: true,
      total: 2,
    };
    teacherHook.value = {
      batches: [{
        id: 'batch-1', title: 'Đợt 1', message: null, status: 'sent', template_name: 'Mẫu',
        total_certificates: 1, sent_certificates: 1, failed_certificates: 0,
        created_at: '2026-08-15T00:00:00.000Z', sent_at: '2026-08-15T00:01:00.000Z',
      }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createBatch: vi.fn(),
      retryBatch: vi.fn(),
      revokeCertificate: vi.fn(async () => undefined),
      fetchBatchDetail: vi.fn(async () => ({
        batch: {
          id: 'batch-1', title: 'Đợt 1', message: null, status: 'sent', template_name: 'Mẫu',
          total_certificates: 1, sent_certificates: 1, failed_certificates: 0,
          created_at: '2026-08-15T00:00:00.000Z', sent_at: '2026-08-15T00:01:00.000Z',
        },
        certificates: [{
          id: 'cert-1', student_id: 'student-1', student_name: 'Nguyễn Văn A', status: 'sent',
          student_score: 10, quiz_title: 'Toán', image_url: '/api/certificates/cert-1/image',
          error_message: null, sent_at: '2026-08-15T00:01:00.000Z',
        }],
      })),
    };
  });

  it('loads the next achievements page from the student route', () => {
    render(<StudentAchievementsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Xem thêm chứng nhận/i }));
    expect(studentHook.value.loadMore).toHaveBeenCalledOnce();
    expect(screen.getByText('1/2 chứng nhận')).toBeInTheDocument();
  });

  it('gives teachers view, download, and revoke controls for issued certificates', async () => {
    render(<TeacherCertificatesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết Đợt 1/i }));

    expect(await screen.findByRole('button', { name: /Xem ảnh.*Nguyễn Văn A/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Tải.*Nguyễn Văn A/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Thu hồi.*Nguyễn Văn A/i })).toBeEnabled();
  });
});
