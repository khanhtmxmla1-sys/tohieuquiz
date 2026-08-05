import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchTeacherActionCenter: vi.fn(),
  deleteDraft: vi.fn(),
  removeLocalDraft: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../src/services/teacherActionCenterService', () => ({
  fetchTeacherActionCenter: mocks.fetchTeacherActionCenter,
}));
vi.mock('../src/services/manualQuizDraftService', () => ({
  deleteRemoteManualQuizDraftIfExists: mocks.deleteDraft,
}));
vi.mock('../src/features/manual-quiz-workspace/draft/manualQuizDraftRepository', () => ({
  removeLocalDraft: mocks.removeLocalDraft,
}));
vi.mock('../src/utils/toast', () => ({
  showSuccess: mocks.showSuccess,
  showError: mocks.showError,
}));

import ActionCenterPanel from '../src/components/TeacherDashboard/overview/ActionCenterPanel';

const generatedAt = '2026-07-28T08:00:00.000Z';
const draftItem = {
  id: 'drafts-unpublished',
  kind: 'draft_unpublished' as const,
  severity: 'info' as const,
  title: 'Bản nháp chưa hoàn tất',
  explanation: '1 bản nháp cần tiếp tục.',
  count: 1,
  generatedAt,
  cta: {
    label: 'Tiếp tục bản nháp',
    url: '/teacher/quizzes/new?draftId=draft-latest',
  },
  secondaryAction: {
    kind: 'delete_draft' as const,
    label: 'Xóa bản nháp',
    resourceId: 'draft-latest',
    resourceLabel: 'Đề Toán đang soạn',
    ownerUsername: 'teacher-a',
  },
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

const renderPanel = () => render(
  <MemoryRouter initialEntries={['/teacher/overview']}>
    <ActionCenterPanel />
    <LocationProbe />
  </MemoryRouter>,
);

describe('ActionCenterPanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it('renders scoped actions and navigates to the exact internal filter URL', async () => {
    mocks.fetchTeacherActionCenter.mockResolvedValue({
      generatedAt,
      items: [{
        id: 'assignment-at-risk',
        kind: 'assignment_at_risk',
        severity: 'critical',
        title: 'Bài giao sắp đến hạn',
        explanation: '2 bài còn 7 học sinh chưa nộp trong 48 giờ tới.',
        count: 2,
        generatedAt,
        cta: {
          label: 'Xem bài cần xử lý',
          url: '/teacher/assignments?status=OPEN&due=48',
        },
      }],
    });

    renderPanel();

    expect(await screen.findByText('Bài giao sắp đến hạn')).toBeInTheDocument();
    expect(screen.getByText(/7 học sinh chưa nộp/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Xem bài cần xử lý/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/teacher/assignments?status=OPEN&due=48');
    expect(screen.queryByRole('button', { name: 'Xóa bản nháp' })).not.toBeInTheDocument();
  });

  it('renders the low-stock action without breaking the draft actions', async () => {
    mocks.fetchTeacherActionCenter.mockResolvedValue({
      generatedAt,
      items: [
        {
          id: 'gift-low-stock',
          kind: 'gift_low_stock',
          severity: 'warning',
          title: 'Phần thưởng sắp hết hàng',
          explanation: '1 phần thưởng đã chạm ngưỡng tồn kho thấp.',
          count: 1,
          generatedAt,
          cta: {
            label: 'Kiểm tra tồn kho',
            url: '/teacher/gift-shop?tab=catalog&stock=low',
          },
        },
        draftItem,
      ],
    });

    renderPanel();

    expect(await screen.findByText('Phần thưởng sắp hết hàng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kiểm tra tồn kho/i })).toHaveAttribute(
      'href',
      '/teacher/gift-shop?tab=catalog&stock=low',
    );
    expect(screen.getByRole('link', { name: /Tiếp tục bản nháp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa bản nháp' })).toBeEnabled();
  });

  it('requires confirmation and keeps the draft when the teacher chooses Giữ lại', async () => {
    mocks.fetchTeacherActionCenter.mockResolvedValue({ generatedAt, items: [draftItem] });

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa bản nháp' }));
    const dialog = screen.getByRole('dialog', { name: 'Xóa bản nháp này?' });
    expect(within(dialog).getByText(/Đề Toán đang soạn/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Giữ lại' }));

    expect(screen.queryByRole('dialog', { name: 'Xóa bản nháp này?' })).not.toBeInTheDocument();
    expect(mocks.deleteDraft).not.toHaveBeenCalled();
  });

  it('deletes the remote and local draft, then reloads the action center', async () => {
    mocks.fetchTeacherActionCenter
      .mockResolvedValueOnce({ generatedAt, items: [draftItem] })
      .mockResolvedValueOnce({ generatedAt, items: [] });
    mocks.deleteDraft.mockResolvedValue(undefined);

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa bản nháp' }));
    const dialog = screen.getByRole('dialog', { name: 'Xóa bản nháp này?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa bản nháp' }));

    await waitFor(() => expect(mocks.deleteDraft).toHaveBeenCalledWith('draft-latest'));
    expect(mocks.removeLocalDraft).toHaveBeenCalledWith('teacher-a', 'draft-latest');
    await waitFor(() => expect(mocks.fetchTeacherActionCenter).toHaveBeenCalledTimes(2));
    expect(mocks.showSuccess).toHaveBeenCalledWith('Đã xóa bản nháp.');
    expect(await screen.findByText('Không có việc gấp trong phạm vi hiện tại')).toBeInTheDocument();
  });

  it('keeps the draft and exposes the error when deletion fails', async () => {
    mocks.fetchTeacherActionCenter.mockResolvedValue({ generatedAt, items: [draftItem] });
    mocks.deleteDraft.mockRejectedValue(new Error('Máy chủ tạm thời gián đoạn'));

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Xóa bản nháp' }));
    const dialog = screen.getByRole('dialog', { name: 'Xóa bản nháp này?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa bản nháp' }));

    await waitFor(() => expect(mocks.showError).toHaveBeenCalledWith('Máy chủ tạm thời gián đoạn'));
    expect(mocks.removeLocalDraft).not.toHaveBeenCalled();
    expect(mocks.fetchTeacherActionCenter).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Bản nháp chưa hoàn tất')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Xóa bản nháp' })).toBeEnabled();
  });

  it('shows a calm empty state when no work is urgent', async () => {
    mocks.fetchTeacherActionCenter.mockResolvedValue({ generatedAt, items: [] });

    renderPanel();

    expect(await screen.findByText('Không có việc gấp trong phạm vi hiện tại')).toBeInTheDocument();
  });

  it('keeps a retry surface when the request fails', async () => {
    mocks.fetchTeacherActionCenter.mockRejectedValue(new Error('Mạng tạm thời gián đoạn'));

    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('Mạng tạm thời gián đoạn');
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeEnabled();
  });
});
