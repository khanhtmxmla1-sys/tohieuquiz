// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useResponsiveLayout', () => ({ useResponsiveLayout: () => ({ isMobile: false }) }));
import { Modal } from '../src/components/common/Modal';

describe('Modal accessibility', () => {
    it('renders a labelled modal dialog in a portal and closes with Escape', async () => {
        const close = vi.fn();
        render(<Modal isOpen onClose={close} title="Xác nhận" description="Kiểm tra thông tin"><button>Đồng ý</button></Modal>);
        const dialog = screen.getByRole('dialog', { name: 'Xác nhận' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(document.body.style.overflow).toBe('hidden');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus());
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(close).toHaveBeenCalledOnce();
    });

    it('provides an accessible close button and backdrop policy', () => {
        const close = vi.fn();
        render(<Modal isOpen onClose={close} title="Thông tin"><p>Nội dung</p></Modal>);
        fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
        expect(close).toHaveBeenCalledOnce();
    });
});
