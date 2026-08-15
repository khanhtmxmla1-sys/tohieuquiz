import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessCodeDialog } from '../src/components/TeacherDashboard/teacher-dashboard-shell/AccessCodeDialog';

const Harness = () => {
  const [editingAccessCode, setEditingAccessCode] = useState<{
    quizId: string;
    currentCode: string;
  } | null>(null);
  const [newAccessCode, setNewAccessCode] = useState('');

  return (
    <>
      <button
        type="button"
        onClick={() => setEditingAccessCode({ quizId: 'quiz-1', currentCode: 'OLD1' })}
      >
        Mở cập nhật mã
      </button>
      <AccessCodeDialog
        editingAccessCode={editingAccessCode}
        newAccessCode={newAccessCode}
        setNewAccessCode={setNewAccessCode}
        onClose={() => setEditingAccessCode(null)}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    </>
  );
};

describe('AccessCodeDialog accessibility', () => {
  it('exposes a named modal, labels the field and focuses the editable code', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở cập nhật mã' }));

    expect(screen.getByRole('dialog', { name: 'Cập nhật mã làm bài' }))
      .toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('textbox', { name: 'Mã mới' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Đóng hộp thoại cập nhật mã làm bài' }))
      .toBeInTheDocument();
  });

  it('traps focus, closes with Escape and restores opener focus', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Mở cập nhật mã' });
    opener.focus();
    fireEvent.click(opener);

    const close = screen.getByRole('button', { name: 'Đóng hộp thoại cập nhật mã làm bài' });
    const save = screen.getByRole('button', { name: 'Lưu mã' });

    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
