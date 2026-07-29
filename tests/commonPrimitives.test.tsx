// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Alert, AsyncState, Button, Input } from '../src/components/common';

describe('common primitives', () => {
    it('exposes loading state and disables Button activation', () => {
        const onClick = vi.fn();
        render(<Button loading onClick={onClick}>Lưu</Button>);
        const button = screen.getByRole('button', { name: 'Lưu' });
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    it('connects Input label, description and error', () => {
        render(<Input label="Tên lớp" description="Nhập tên hiển thị" error="Bắt buộc" />);
        const input = screen.getByLabelText('Tên lớp');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        const describedBy = input.getAttribute('aria-describedby') || '';
        expect(describedBy).toContain('description');
        expect(describedBy).toContain('error');
    });

    it('uses an alert role for dangerous feedback', () => {
        render(<Alert tone="danger" title="Lỗi">Không thể lưu</Alert>);
        expect(screen.getByRole('alert')).toHaveTextContent('Không thể lưu');
    });

    it('provides a bounded retry action in AsyncState', () => {
        const retry = vi.fn();
        render(<AsyncState error="Mạng yếu" onRetry={retry}><div>data</div></AsyncState>);
        fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
        expect(retry).toHaveBeenCalledOnce();
    });
});
