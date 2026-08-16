import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResetPasswordModal } from '../src/features/class-management/components/Modals/ResetPasswordModal';

describe('ResetPasswordModal accessibility', () => {
  it('focuses the temporary password and closes with Escape', () => {
    const onClose = vi.fn();
    render(
      <ResetPasswordModal
        student={{ id: 's1', fullName: 'Hoc Sinh Mau', username: 'student-a', classId: 'c1' }}
        isSaving={false}
        error={null}
        onClose={onClose}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    const input = screen.getByLabelText('Mật khẩu tạm thời');
    expect(screen.getByRole('dialog', { name: 'Đặt lại mật khẩu' })).toBeInTheDocument();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
