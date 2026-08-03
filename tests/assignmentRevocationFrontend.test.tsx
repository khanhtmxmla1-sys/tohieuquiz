import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeApiAction } from '../src/services/api/apiClient';
import AssignmentRevokeDialog from '../src/components/TeacherDashboard/assignment-tab/AssignmentRevokeDialog';
import AssignmentTrackingSection from '../src/components/TeacherDashboard/AssignmentTrackingSection';
import type { Assignment } from '../src/types/classroom.types';

const assignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  id: 'assignment-1',
  quizId: 'quiz-1',
  classId: 'class-1',
  quizTitle: 'Đại từ sở hữu',
  className: '4A',
  deadline: '2099-01-01T00:00:00.000Z',
  maxAttempts: 1,
  status: 'OPEN',
  createdAt: '2026-08-03T00:00:00.000Z',
  submittedCount: 0,
  totalStudents: 30,
  ...overrides,
});

describe('assignment revocation frontend contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps revoke_assignment to the canonical POST endpoint and body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'success', data: {} }), { status: 200 }),
    );

    await executeApiAction('revoke_assignment', {
      assignmentId: 'assignment-1',
      reason: 'Phát hiện đáp án chưa chính xác',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/assignments/assignment-1/revoke');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      reason: 'Phát hiện đáp án chưa chính xác',
    });
  });

  it('requires a reason and submits the teacher explanation', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true);
    render(
      <AssignmentRevokeDialog
        assignment={assignment()}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Thu hồi bài đã giao' })).toBeTruthy();
    const reason = screen.getByRole('textbox', { name: 'Lý do thu hồi' });
    fireEvent.change(reason, { target: { value: 'Đáp án câu 5 chưa chính xác' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi bài' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Đáp án câu 5 chưa chính xác'));
  });

  it('blocks revocation when completed submissions exist and directs the teacher to close the assignment', () => {
    render(
      <AssignmentRevokeDialog
        assignment={assignment({ submittedCount: 2 })}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/đã có 2 học sinh nộp/i)).toBeTruthy();
    expect(screen.getByText(/hãy đóng bài/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xác nhận thu hồi bài' })).toBeDisabled();
  });

  it('shows revoked history and removes edit/reopen/revoke controls', () => {
    render(
      <AssignmentTrackingSection
        assignments={[assignment({
          status: 'REVOKED',
          revokedReason: 'Đáp án câu 5 chưa chính xác',
          revokedAt: '2026-08-03T16:00:00.000Z',
        })]}
        onRevoke={vi.fn().mockResolvedValue(true)}
        onUpdateDeadline={vi.fn().mockResolvedValue(true)}
        onUpdateStatus={vi.fn().mockResolvedValue(true)}
        isLoading={false}
      />,
    );

    expect(screen.getAllByText('Đã thu hồi').length).toBeGreaterThan(0);
    expect(screen.getByText('Đáp án câu 5 chưa chính xác')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Thu hồi bài giao/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sửa hạn nộp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mở lại bài giao' })).toBeNull();
  });
});
