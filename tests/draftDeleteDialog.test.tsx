import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DraftDeleteDialog from '../src/components/TeacherDashboard/overview/DraftDeleteDialog';

const action = {
  kind: 'delete_draft' as const,
  label: 'Xóa bản nháp',
  resourceId: 'draft-latest',
  resourceLabel: 'Đề Toán đang soạn',
  ownerUsername: 'teacher-a',
};

describe('DraftDeleteDialog', () => {
  it('explains the impact and exposes safe cancel and destructive actions', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DraftDeleteDialog
        action={action}
        isDeleting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Xóa bản nháp này?' });
    expect(within(dialog).getByText('Đề Toán đang soạn')).toBeInTheDocument();
    expect(within(dialog).getByText(/Đề đã xuất bản và dữ liệu học sinh không bị ảnh hưởng/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Giữ lại' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa bản nháp' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('locks the dialog while deletion is in progress', () => {
    render(
      <DraftDeleteDialog
        action={action}
        isDeleting
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Xóa bản nháp này?' });
    expect(within(dialog).getByRole('button', { name: 'Giữ lại' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Xóa bản nháp' })).toBeDisabled();
  });
});
