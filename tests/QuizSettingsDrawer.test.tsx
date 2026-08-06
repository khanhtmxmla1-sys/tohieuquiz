import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizSettingsDrawer from '../src/features/manual-quiz-workspace/components/QuizSettingsDrawer';

const renderDrawer = (overrides: Partial<React.ComponentProps<typeof QuizSettingsDrawer>> = {}) => {
    const props: React.ComponentProps<typeof QuizSettingsDrawer> = {
        open: true,
        timeLimit: 20,
        onClose: vi.fn(),
        onApply: vi.fn(),
        ...overrides,
    };
    render(<QuizSettingsDrawer {...props} />);
    return props;
};

describe('QuizSettingsDrawer', () => {
    it('loads the current duration and focuses the minutes input', async () => {
        renderDrawer();

        const input = screen.getByRole('spinbutton', { name: 'Thời gian làm bài (phút)' });
        expect(input).toHaveValue(20);
        await waitFor(() => expect(input).toHaveFocus());
    });

    it('applies a preset only after the teacher confirms', () => {
        const props = renderDrawer();

        fireEvent.click(screen.getByRole('button', { name: 'Chọn 45 phút' }));
        expect(screen.getByRole('spinbutton', { name: 'Thời gian làm bài (phút)' })).toHaveValue(45);
        expect(props.onApply).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thiết lập' }));
        expect(props.onApply).toHaveBeenCalledWith(45);
    });

    it('blocks invalid values with a readable error', () => {
        const props = renderDrawer();
        const input = screen.getByRole('spinbutton', { name: 'Thời gian làm bài (phút)' });

        fireEvent.change(input, { target: { value: '0' } });
        fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thiết lập' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Thời gian làm bài phải từ 1 phút trở lên.');
        expect(props.onApply).not.toHaveBeenCalled();
    });

    it('allows unusually long durations after showing a warning', () => {
        const props = renderDrawer();
        const input = screen.getByRole('spinbutton', { name: 'Thời gian làm bài (phút)' });

        fireEvent.change(input, { target: { value: '181' } });
        expect(screen.getByText(/dài hơn mức thường dùng/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thiết lập' }));

        expect(props.onApply).toHaveBeenCalledWith(181);
    });

    it('supports cancellation and Escape without applying changes', () => {
        const props = renderDrawer();

        fireEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onApply).not.toHaveBeenCalled();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it('shows the current duration without edit controls in read-only mode', async () => {
        renderDrawer({ readOnly: true, timeLimit: 60 });

        expect(screen.getByRole('spinbutton', { name: 'Thời gian làm bài (phút)' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Áp dụng thiết lập' })).not.toBeInTheDocument();
        expect(screen.getByText('Đề đang ở chế độ chỉ đọc.')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Đóng thiết lập đề' })).toHaveFocus());
    });
});
