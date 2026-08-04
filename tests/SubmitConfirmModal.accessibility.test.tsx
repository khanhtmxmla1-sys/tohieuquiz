import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmitConfirmModal from '../src/components/student/SubmitConfirmModal';

const Harness = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Mở xác nhận</button>
      <SubmitConfirmModal
        isOpen={open}
        emptyCount={1}
        partialCount={1}
        onCancel={() => setOpen(false)}
        onConfirm={vi.fn()}
      />
    </>
  );
};

describe('SubmitConfirmModal accessibility', () => {
  it('exposes a named modal dialog and focuses the safe action', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở xác nhận' }));

    expect(screen.getByRole('dialog', { name: 'Nộp bài ngay?' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/1 câu chưa bắt đầu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toHaveFocus();
  });

  it('traps Tab in the dialog, closes with Escape and restores opener focus', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Mở xác nhận' });
    opener.focus();
    fireEvent.click(opener);

    const cancel = screen.getByRole('button', { name: 'Quay lại' });
    const confirm = screen.getByRole('button', { name: 'Đồng ý nộp' });
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
