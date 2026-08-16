import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SystemDialogHost } from '../src/components/common/SystemDialogHost';
import { showConfirm, showPrompt } from '../src/utils/toast';

describe('SystemDialogHost accessibility', () => {
  it('renders showConfirm as a named modal dialog, focuses cancel, traps focus and restores the opener', async () => {
    const onConfirm = vi.fn();
    render(
      <>
        <button type="button">Mở thao tác</button>
        <SystemDialogHost />
      </>,
    );

    const opener = screen.getByRole('button', { name: 'Mở thao tác' });
    opener.focus();

    await act(async () => {
      void showConfirm({
        message: 'Xóa dữ liệu này?',
        confirmLabel: 'Xóa',
        cancelLabel: 'Hủy',
        destructive: true,
        onConfirm,
      });
    });

    const dialog = screen.getByRole('dialog', { name: 'Xác nhận thao tác' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Xóa dữ liệu này?')).toBeInTheDocument();

    const cancel = screen.getByRole('button', { name: 'Hủy' });
    const confirm = screen.getByRole('button', { name: 'Xóa' });
    expect(cancel).toHaveFocus();

    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('resolves confirm and prompt requests without native browser dialogs', async () => {
    render(<SystemDialogHost />);

    let confirmResult: boolean | undefined;
    await act(async () => {
      const promise = showConfirm({ message: 'Tiếp tục?', confirmLabel: 'Tiếp tục' });
      fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục' }));
      confirmResult = await promise;
    });
    expect(confirmResult).toBe(true);

    let promptResult: string | null | undefined;
    await act(async () => {
      const promise = showPrompt({
        title: 'Tên bài tập',
        message: 'Nhập tên bài tập',
        defaultValue: 'Bài cũ',
        confirmLabel: 'Lưu',
      });
      const input = await screen.findByRole('textbox', { name: 'Nhập tên bài tập' });
      fireEvent.change(input, { target: { value: 'Bài mới' } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
      promptResult = await promise;
    });
    expect(promptResult).toBe('Bài mới');
  });
});
